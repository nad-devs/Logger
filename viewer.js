#!/usr/bin/env node

const db = require('./database');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('         CURSOR AI INTERACTION LOG VIEWER');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Get all interactions
const interactions = db.getAllInteractions();

if (interactions.length === 0) {
  console.log('No interactions logged yet.');
  console.log('\nTo test:');
  console.log('1. Open this project in Cursor');
  console.log('2. Chat with Cursor AI and ask it to edit a file');
  console.log('3. Run this viewer again to see the logged data\n');
  process.exit(0);
}

console.log(`Found ${interactions.length} interaction(s)\n`);

// Display each interaction
interactions.forEach((interaction, index) => {
  console.log(`┌─ Interaction #${index + 1} ─────────────────────────────────────`);
  console.log(`│ Timestamp: ${interaction.timestamp}`);
  console.log(`│ Source: ${interaction.source || 'unknown'}`);
  console.log(`│ Conversation ID: ${interaction.conversation_id}`);
  console.log(`│`);
  console.log(`│ ▶ PROMPT:`);

  // Display prompt (handle multiline)
  const promptLines = interaction.prompt_text.split('\n');
  promptLines.forEach(line => {
    console.log(`│   ${line}`);
  });

  console.log(`│`);

  if (interaction.edits && interaction.edits.length > 0) {
    console.log(`│ ▶ FILES CHANGED: ${interaction.edits.length} edit(s)`);
    console.log(`│`);

    interaction.edits.forEach((edit, editIndex) => {
      console.log(`│   [${editIndex + 1}] ${edit.file_path}`);
      console.log(`│       Timestamp: ${edit.timestamp}`);
      console.log(`│       Source: ${edit.source || 'unknown'}`);

      // Show a preview of the change (first 100 chars)
      if (edit.old_string || edit.new_string) {
        console.log(`│       Old: ${truncate(edit.old_string || '(empty)', 80)}`);
        console.log(`│       New: ${truncate(edit.new_string || '(empty)', 80)}`);
      }
      console.log(`│`);
    });
  } else {
    console.log(`│ ▶ FILES CHANGED: None (prompt only)`);
    console.log(`│`);
  }

  console.log(`└────────────────────────────────────────────────────────\n`);
});

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Total Prompts: ${interactions.length}`);
const totalEdits = interactions.reduce((sum, i) => sum + (i.edits?.length || 0), 0);
console.log(`Total Edits: ${totalEdits}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('💡 Tip: Query the database directly for more details:');
console.log('   sqlite3 cursor-interactions.db "SELECT * FROM prompts;"\n');

// Helper function to truncate long strings
function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}
