#!/usr/bin/env node

/**
 * Phase 1 Schema Migration
 *
 * Adds new tables and fields needed for Enhanced Evaluation Engine:
 * - ai_responses: Capture AI suggestions
 * - code_modifications: Track how developers modify AI code
 * - debugging_sessions: Track error → fix cycles
 * - flag_incidents: Store red/green flags with evidence
 *
 * This migration is idempotent - safe to run multiple times.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'cursor-interactions.db');
console.log(`\n📦 Phase 1 Schema Migration`);
console.log(`Database: ${dbPath}\n`);

let db;
try {
  db = new Database(dbPath);
} catch (err) {
  console.error('❌ Failed to open database:', err.message);
  process.exit(1);
}

function runMigration() {
  console.log('🔄 Running migration...\n');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  try {
    // 1. Create ai_responses table
    console.log('  Creating ai_responses table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        prompt_id INTEGER NOT NULL,
        response_content TEXT NOT NULL,
        model_name TEXT,
        tokens_used INTEGER,
        response_time_ms INTEGER,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
      );
    `);
    console.log('    ✅ ai_responses table created');

    // 2. Create code_modifications table
    console.log('  Creating code_modifications table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS code_modifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        ai_response_id INTEGER,
        original_suggestion TEXT,
        final_code TEXT,
        modification_type TEXT,
        lines_changed INTEGER,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (ai_response_id) REFERENCES ai_responses(id) ON DELETE CASCADE
      );
    `);
    console.log('    ✅ code_modifications table created');

    // 3. Create debugging_sessions table
    console.log('  Creating debugging_sessions table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS debugging_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        error_type TEXT,
        error_message TEXT,
        stack_trace TEXT,
        resolution_prompts TEXT,
        resolution_time_ms INTEGER,
        independent_resolution INTEGER DEFAULT 0,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    console.log('    ✅ debugging_sessions table created');

    // 4. Create flag_incidents table
    console.log('  Creating flag_incidents table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS flag_incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        flag_type TEXT NOT NULL,
        flag_category TEXT NOT NULL,
        severity INTEGER NOT NULL,
        description TEXT NOT NULL,
        evidence TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    console.log('    ✅ flag_incidents table created');

    // 5. Create indexes for performance
    console.log('  Creating indexes...');
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ai_responses_conversation ON ai_responses(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_ai_responses_prompt ON ai_responses(prompt_id);
      CREATE INDEX IF NOT EXISTS idx_code_mods_conversation ON code_modifications(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_code_mods_ai_response ON code_modifications(ai_response_id);
      CREATE INDEX IF NOT EXISTS idx_debugging_conversation ON debugging_sessions(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_flags_conversation ON flag_incidents(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_flags_type ON flag_incidents(flag_type);
      CREATE INDEX IF NOT EXISTS idx_prompts_sequence ON prompts(conversation_id, timestamp);
    `);
    console.log('    ✅ Indexes created');

    // 6. Add new columns to existing tables (if they don't exist)
    console.log('  Enhancing existing tables...');

    // Check and add columns to prompts table
    const promptsColumns = db.pragma('table_info(prompts)');
    const promptsColumnNames = promptsColumns.map(col => col.name);

    if (!promptsColumnNames.includes('prompt_sequence_number')) {
      db.exec(`ALTER TABLE prompts ADD COLUMN prompt_sequence_number INTEGER DEFAULT 1;`);
      console.log('    ✅ Added prompt_sequence_number to prompts table');
    } else {
      console.log('    ℹ️  prompt_sequence_number already exists');
    }

    if (!promptsColumnNames.includes('parent_prompt_id')) {
      db.exec(`ALTER TABLE prompts ADD COLUMN parent_prompt_id INTEGER;`);
      console.log('    ✅ Added parent_prompt_id to prompts table');
    } else {
      console.log('    ℹ️  parent_prompt_id already exists');
    }

    if (!promptsColumnNames.includes('is_question')) {
      db.exec(`ALTER TABLE prompts ADD COLUMN is_question INTEGER DEFAULT 0;`);
      console.log('    ✅ Added is_question to prompts table');
    } else {
      console.log('    ℹ️  is_question already exists');
    }

    if (!promptsColumnNames.includes('is_debugging')) {
      db.exec(`ALTER TABLE prompts ADD COLUMN is_debugging INTEGER DEFAULT 0;`);
      console.log('    ✅ Added is_debugging to prompts table');
    } else {
      console.log('    ℹ️  is_debugging already exists');
    }

    // Check and add columns to edits table
    const editsColumns = db.pragma('table_info(edits)');
    const editsColumnNames = editsColumns.map(col => col.name);

    if (!editsColumnNames.includes('modification_source')) {
      db.exec(`ALTER TABLE edits ADD COLUMN modification_source TEXT;`);
      console.log('    ✅ Added modification_source to edits table');
    } else {
      console.log('    ℹ️  modification_source already exists');
    }

    if (!editsColumnNames.includes('revert_of_edit_id')) {
      db.exec(`ALTER TABLE edits ADD COLUMN revert_of_edit_id INTEGER;`);
      console.log('    ✅ Added revert_of_edit_id to edits table');
    } else {
      console.log('    ℹ️  revert_of_edit_id already exists');
    }

    // 7. Backfill prompt_sequence_number for existing prompts
    console.log('  Backfilling sequence numbers...');
    const conversations = db.prepare(`
      SELECT DISTINCT conversation_id FROM prompts
    `).all();

    for (const conv of conversations) {
      const prompts = db.prepare(`
        SELECT id FROM prompts
        WHERE conversation_id = ?
        ORDER BY timestamp ASC
      `).all(conv.conversation_id);

      prompts.forEach((prompt, index) => {
        db.prepare(`
          UPDATE prompts
          SET prompt_sequence_number = ?
          WHERE id = ?
        `).run(index + 1, prompt.id);
      });
    }
    console.log(`    ✅ Backfilled ${conversations.length} conversations`);

    console.log('\n✨ Migration completed successfully!\n');

    // Display summary
    const tableCount = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM prompts) as prompts,
        (SELECT COUNT(*) FROM edits) as edits,
        (SELECT COUNT(*) FROM ai_responses) as ai_responses,
        (SELECT COUNT(*) FROM code_modifications) as code_modifications,
        (SELECT COUNT(*) FROM debugging_sessions) as debugging_sessions,
        (SELECT COUNT(*) FROM flag_incidents) as flag_incidents
    `).get();

    console.log('📊 Database Summary:');
    console.log(`  Prompts: ${tableCount.prompts}`);
    console.log(`  Edits: ${tableCount.edits}`);
    console.log(`  AI Responses: ${tableCount.ai_responses}`);
    console.log(`  Code Modifications: ${tableCount.code_modifications}`);
    console.log(`  Debugging Sessions: ${tableCount.debugging_sessions}`);
    console.log(`  Flag Incidents: ${tableCount.flag_incidents}`);
    console.log('');

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
