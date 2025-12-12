#!/usr/bin/env node

const db = require('./database');
const AIResponseLogger = require('./ai-response-logger');
const ModificationTracker = require('./modification-tracker');
const DebuggingTracker = require('./debugging-tracker');
const fs = require('fs');
const path = require('path');

// Initialize trackers
const aiResponseLogger = new AIResponseLogger(db.db);
const modTracker = new ModificationTracker(db.db, aiResponseLogger);
const debugTracker = new DebuggingTracker(db.db);

// Read JSON data from stdin
let inputData = '';

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    // Parse the JSON data from Cursor/Claude
    const data = JSON.parse(inputData);

    // Debug log - ALWAYS log to see what we're receiving
    const logPath = path.join(__dirname, 'hook-debug.log');
    fs.appendFileSync(logPath, `[EDIT] ${new Date().toISOString()}\n${JSON.stringify(data, null, 2)}\n\n`);

    // Extract conversation/session ID
    const conversationId = data.conversation_id || data.conversationId || data.session_id || 'unknown';

    // Determine source: Claude Code uses session_id and tool_input, Cursor uses conversation_id
    const source = data.session_id || data.tool_input ? 'claude-code' : 'cursor';

    // Claude Code sends tool parameters differently
    // For Edit tool: { file_path, old_string, new_string }
    // For Write tool: { file_path, content }
    let filePath = data.file_path || data.filePath || data.path;
    let edits = data.edits || [];

    // Handle Claude Code's Edit tool format (uses tool_input)
    if (!filePath && data.tool_input) {
      filePath = data.tool_input.file_path || data.tool_input.filePath;
    }

    // Handle Claude Code's tool parameters
    if (edits.length === 0) {
      if (data.tool_input) {
        // Edit tool format
        if (data.tool_input.old_string !== undefined || data.tool_input.new_string !== undefined) {
          edits.push({
            old_string: data.tool_input.old_string || '',
            new_string: data.tool_input.new_string || ''
          });
        }
        // Write tool format
        else if (data.tool_input.content !== undefined) {
          edits.push({
            old_string: '',
            new_string: data.tool_input.content || ''
          });
        }
      }
      // Cursor format (direct fields)
      else if (data.old_string !== undefined || data.new_string !== undefined) {
        edits.push({
          old_string: data.old_string || '',
          new_string: data.new_string || ''
        });
      }
    }

    // Skip if we couldn't extract meaningful data
    if (!filePath || filePath === 'unknown' || edits.length === 0) {
      fs.appendFileSync(logPath, `[EDIT SKIP] No valid file path or edits found\n\n`);
      process.exit(0);
    }

    // Log each edit to the database
    let editCount = 0;
    for (const edit of edits) {
      const oldString = edit.old_string || edit.oldString || '';
      const newString = edit.new_string || edit.newString || '';

      // Insert edit with enhanced fields
      const result = db.db.prepare(`
        INSERT INTO edits
        (conversation_id, file_path, old_string, new_string, source, modification_source)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(conversationId, filePath, oldString, newString, source, 'pending');

      const editId = result.lastInsertRowid;

      // Track code modifications (AI vs manual)
      modTracker.trackModification(conversationId, editId, newString).catch(err => {
        fs.appendFileSync(logPath, `[WARN] Failed to track modification: ${err.message}\n`);
      });

      editCount++;
    }

    // Check if this resolves an active debugging session
    debugTracker.checkResolution(conversationId, true);

    fs.appendFileSync(logPath, `[EDIT SUCCESS] Conv: ${conversationId}, File: ${filePath}, Edits: ${editCount}\n\n`);

    // Exit successfully
    process.exit(0);
  } catch (error) {
    // Log error but don't crash Cursor
    const errorPath = path.join(__dirname, 'hook-errors.log');
    fs.appendFileSync(errorPath, `[ERROR] ${new Date().toISOString()} - Edit Logger\n${error.stack}\nInput: ${inputData}\n\n`);

    // Exit with error code
    process.exit(1);
  }
});

// Handle stdin errors
process.stdin.on('error', (error) => {
  console.error('Error reading stdin:', error);
  process.exit(1);
});
