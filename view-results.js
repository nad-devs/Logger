#!/usr/bin/env node

/**
 * View analysis results for a conversation
 *
 * Usage: node view-results.js <conversation_id>
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'cursor-interactions.db');

function viewResults(conversationId) {
  const db = new sqlite3.Database(DB_PATH);

  console.log('='.repeat(70));
  console.log('ANALYSIS RESULTS');
  console.log('='.repeat(70));
  console.log(`Conversation ID: ${conversationId}\n`);

  // Get all results for this conversation
  db.all(
    `SELECT analyzer_name, score, verdict, confidence, analyzed_at, analysis_data
     FROM analysis_results
     WHERE conversation_id = ?
     ORDER BY analyzer_name`,
    [conversationId],
    (err, rows) => {
      if (err) {
        console.error('Error:', err.message);
        db.close();
        return;
      }

      if (rows.length === 0) {
        console.log('No analysis results found for this conversation.');
        console.log('\nPossible reasons:');
        console.log('  1. Conversation not yet analyzed (run: node background-analyzer.js)');
        console.log('  2. Conversation has less than 3 prompts');
        console.log('  3. Invalid conversation ID');
        db.close();
        return;
      }

      // Display summary
      let totalScore = 0;
      rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.analyzer_name.toUpperCase()}`);
        console.log(`   Score: ${row.score.toFixed(1)}/10`);
        console.log(`   Verdict: ${row.verdict}`);
        console.log(`   Confidence: ${(row.confidence * 100).toFixed(0)}%`);
        console.log(`   Analyzed: ${row.analyzed_at}`);
        console.log('');

        totalScore += row.score;
      });

      // Overall score
      const avgScore = totalScore / rows.length;
      console.log('='.repeat(70));
      console.log(`OVERALL SCORE: ${avgScore.toFixed(1)}/10`);
      console.log('='.repeat(70));

      // Show detailed breakdown option
      console.log('\nFor detailed analysis data:');
      console.log(`  SELECT analysis_data FROM analysis_results WHERE conversation_id = '${conversationId}' AND analyzer_name = '<analyzer_name>';`);

      db.close();
    }
  );
}

// List all analyzed conversations
function listConversations() {
  const db = new sqlite3.Database(DB_PATH);

  console.log('='.repeat(70));
  console.log('ANALYZED CONVERSATIONS');
  console.log('='.repeat(70));

  db.all(
    `SELECT ar.conversation_id,
            COUNT(ar.analyzer_name) as analyzer_count,
            AVG(ar.score) as avg_score,
            MAX(ar.analyzed_at) as last_analyzed,
            (SELECT COUNT(*) FROM prompts p WHERE p.conversation_id = ar.conversation_id) as prompt_count
     FROM analysis_results ar
     GROUP BY ar.conversation_id
     ORDER BY last_analyzed DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error:', err.message);
        db.close();
        return;
      }

      if (rows.length === 0) {
        console.log('No analyzed conversations found.');
        console.log('\nRun the background analyzer:');
        console.log('  node background-analyzer.js');
        db.close();
        return;
      }

      rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.conversation_id}`);
        console.log(`   Prompts: ${row.prompt_count} | Analyzers: ${row.analyzer_count} | Avg Score: ${row.avg_score.toFixed(1)}/10`);
        console.log(`   Last analyzed: ${row.last_analyzed}`);
        console.log('');
      });

      console.log(`\nTo view details: node view-results.js <conversation_id>`);

      db.close();
    }
  );
}

// Parse command line arguments
const conversationId = process.argv[2];

if (!conversationId) {
  // No argument provided - list all conversations
  listConversations();
} else {
  // Show results for specific conversation
  viewResults(conversationId);
}
