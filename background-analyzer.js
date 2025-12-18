#!/usr/bin/env node

/**
 * Background Analysis Service
 *
 * Watches for new conversations and runs all analyzers automatically
 * without blocking the user's coding session.
 *
 * Usage: node background-analyzer.js
 * Or run as daemon: nohup node background-analyzer.js &
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Import all analyzers
const CriticalThinkingAnalyzer = require('./evaluator/understanding/critical-thinking-analyzer');
const DebuggingReasoningAnalyzer = require('./evaluator/understanding/debugging-reasoning-analyzer');
const MistakeCatcherAnalyzer = require('./evaluator/understanding/mistake-catcher-analyzer');

const DB_PATH = path.join(__dirname, 'cursor-interactions.db');
const POLL_INTERVAL = 5000; // Check every 5 seconds
const MIN_PROMPTS_THRESHOLD = 3; // Only analyze conversations with 3+ prompts

class BackgroundAnalyzer {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.analyzedConversations = new Set();
    this.isRunning = false;
    this.initialized = false;
  }

  async initialize() {
    // Create analysis_results table if it doesn't exist
    await this.initializeDatabase();

    // Load previously analyzed conversations
    await this.loadAnalyzedConversations();

    this.initialized = true;
    console.log('[BackgroundAnalyzer] Initialization complete');
  }

  initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS analysis_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id TEXT NOT NULL,
          analyzer_name TEXT NOT NULL,
          score REAL NOT NULL,
          verdict TEXT,
          confidence REAL,
          analysis_data TEXT, -- JSON
          analyzed_at TEXT NOT NULL,
          UNIQUE(conversation_id, analyzer_name)
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('[BackgroundAnalyzer] Database initialized');
          resolve();
        }
      });
    });
  }

  loadAnalyzedConversations() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT DISTINCT conversation_id FROM analysis_results`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          rows.forEach(row => {
            this.analyzedConversations.add(row.conversation_id);
          });

          console.log(`[BackgroundAnalyzer] Loaded ${this.analyzedConversations.size} previously analyzed conversations`);
          resolve();
        }
      );
    });
  }

  async start() {
    this.isRunning = true;
    console.log('[BackgroundAnalyzer] Starting background analysis service...');
    console.log(`[BackgroundAnalyzer] Polling every ${POLL_INTERVAL / 1000} seconds`);
    console.log(`[BackgroundAnalyzer] Minimum prompts threshold: ${MIN_PROMPTS_THRESHOLD}`);

    this.poll();
  }

  async poll() {
    if (!this.isRunning) return;

    try {
      const conversations = await this.getUnanalyzedConversations();

      if (conversations.length > 0) {
        console.log(`[BackgroundAnalyzer] Found ${conversations.length} new conversation(s) to analyze`);

        for (const conv of conversations) {
          await this.analyzeConversation(conv);
        }
      }
    } catch (error) {
      console.error('[BackgroundAnalyzer] Error during poll:', error);
    }

    // Schedule next poll
    setTimeout(() => this.poll(), POLL_INTERVAL);
  }

  async getUnanalyzedConversations() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT conversation_id, COUNT(*) as prompt_count, MAX(timestamp) as last_activity
         FROM prompts
         GROUP BY conversation_id
         HAVING prompt_count >= ?`,
        [MIN_PROMPTS_THRESHOLD],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          // Filter out already analyzed conversations
          const unanalyzed = rows.filter(row => !this.analyzedConversations.has(row.conversation_id));
          resolve(unanalyzed);
        }
      );
    });
  }

  async analyzeConversation(conv) {
    const conversationId = conv.conversation_id;
    const promptCount = conv.prompt_count;

    console.log(`\n[BackgroundAnalyzer] Analyzing conversation: ${conversationId}`);
    console.log(`[BackgroundAnalyzer] Prompts: ${promptCount}, Last activity: ${conv.last_activity}`);

    const startTime = Date.now();

    try {
      // Run all analyzers
      await this.runAnalyzer('CriticalThinking', CriticalThinkingAnalyzer, conversationId);
      await this.runAnalyzer('DebuggingReasoning', DebuggingReasoningAnalyzer, conversationId);
      await this.runAnalyzer('MistakeCatcher', MistakeCatcherAnalyzer, conversationId);

      // Mark as analyzed
      this.analyzedConversations.add(conversationId);

      const duration = Date.now() - startTime;
      console.log(`[BackgroundAnalyzer] ✓ Completed analysis for ${conversationId} in ${(duration / 1000).toFixed(1)}s`);

    } catch (error) {
      console.error(`[BackgroundAnalyzer] ✗ Error analyzing ${conversationId}:`, error.message);
    }
  }

  async runAnalyzer(name, AnalyzerClass, conversationId) {
    try {
      console.log(`  → Running ${name} analyzer...`);

      const analyzer = new AnalyzerClass();
      const result = await analyzer.analyze(conversationId);
      analyzer.close();

      // Store result in database
      await this.storeResult(conversationId, name, result);

      console.log(`  ✓ ${name}: ${result.score.toFixed(1)}/10 (${result.verdict})`);

    } catch (error) {
      console.error(`  ✗ ${name} failed:`, error.message);
    }
  }

  async storeResult(conversationId, analyzerName, result) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const analysisDataJson = JSON.stringify(result);

      this.db.run(
        `INSERT OR REPLACE INTO analysis_results
         (conversation_id, analyzer_name, score, verdict, confidence, analysis_data, analyzed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [conversationId, analyzerName, result.score, result.verdict, result.confidence, analysisDataJson, now],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  stop() {
    this.isRunning = false;
    this.db.close();
    console.log('[BackgroundAnalyzer] Stopped');
  }
}

// Handle graceful shutdown
const analyzer = new BackgroundAnalyzer();

process.on('SIGINT', () => {
  console.log('\n[BackgroundAnalyzer] Received SIGINT, shutting down...');
  analyzer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[BackgroundAnalyzer] Received SIGTERM, shutting down...');
  analyzer.stop();
  process.exit(0);
});

// Initialize and start the service
(async () => {
  await analyzer.initialize();
  analyzer.start();
})();
