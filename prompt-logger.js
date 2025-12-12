#!/usr/bin/env node

const db = require('./database');
const DebuggingTracker = require('./debugging-tracker');
const fs = require('fs');
const path = require('path');

// Initialize debugging tracker
const debugTracker = new DebuggingTracker(db.db);

// Read JSON data from stdin (this is how Cursor passes data to hooks)
let inputData = '';

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    // Parse the JSON data from Cursor
    const data = JSON.parse(inputData);

    // Extract the fields we need
    // Handle both Cursor format (conversation_id) and Claude Code format (session_id)
    const conversationId = data.conversation_id || data.conversationId || data.session_id || 'unknown';
    const promptText = data.prompt || data.prompt_text || data.text || JSON.stringify(data);

    // Determine source: Claude Code uses session_id, Cursor uses conversation_id
    const source = data.session_id ? 'claude-code' : 'cursor';

    // Determine sequence number
    const lastPrompt = db.db.prepare(`
      SELECT MAX(prompt_sequence_number) as max_seq
      FROM prompts WHERE conversation_id = ?
    `).get(conversationId);

    const sequenceNumber = (lastPrompt?.max_seq || 0) + 1;

    // Detect if this is a question
    const isQuestion = /\?|how|what|why|when|where|can you|could you|please/i.test(promptText);

    // Insert with enhanced fields
    const result = db.db.prepare(`
      INSERT INTO prompts
      (conversation_id, prompt_text, source, prompt_sequence_number, is_question)
      VALUES (?, ?, ?, ?, ?)
    `).run(conversationId, promptText, source, sequenceNumber, isQuestion ? 1 : 0);

    const promptId = result.lastInsertRowid;

    // Track debugging activity
    const isDebugging = debugTracker.analyzePromptForDebugging(promptId, promptText, conversationId);

    // Log to file for debugging
    const logPath = path.join(__dirname, 'hook-debug.log');
    fs.appendFileSync(logPath, `[PROMPT] ${new Date().toISOString()} - Conv: ${conversationId}\n` +
      `ID: ${promptId}, Seq: ${sequenceNumber}, Question: ${isQuestion}, Debugging: ${isDebugging}\n` +
      `${JSON.stringify(data, null, 2)}\n\n`);

    // Exit successfully
    process.exit(0);
  } catch (error) {
    // Log error but don't crash Cursor
    const errorPath = path.join(__dirname, 'hook-errors.log');
    fs.appendFileSync(errorPath, `[ERROR] ${new Date().toISOString()} - Prompt Logger\n${error.stack}\nInput: ${inputData}\n\n`);

    // Exit with error code
    process.exit(1);
  }
});

// Handle case where no input is provided
process.stdin.on('error', (error) => {
  console.error('Error reading stdin:', error);
  process.exit(1);
});
