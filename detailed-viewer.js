#!/usr/bin/env node

const db = require('./database');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('      DETAILED INTERACTION LOG VIEWER');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Get all interactions
const interactions = db.getAllInteractions();

if (interactions.length === 0) {
  console.log('No interactions logged yet.\n');
  process.exit(0);
}

// Get interaction ID from command line, or show all
const targetId = process.argv[2];

if (targetId) {
  // Show detailed view of one interaction
  const interaction = interactions.find((_, index) => index + 1 === parseInt(targetId));

  if (!interaction) {
    console.log(`Interaction #${targetId} not found.\n`);
    process.exit(1);
  }

  showDetailedInteraction(interaction, targetId);
} else {
  // Show list of all interactions
  console.log(`Found ${interactions.length} interaction(s)\n`);
  console.log('Usage: node detailed-viewer.js [number] to see full details\n');

  interactions.forEach((interaction, index) => {
    console.log(`${index + 1}. [${interaction.source}] ${interaction.timestamp}`);
    console.log(`   Prompt: ${truncate(interaction.prompt_text, 80)}`);
    console.log(`   Files changed: ${interaction.edits?.length || 0}`);
    console.log('');
  });

  console.log('\nExample: node detailed-viewer.js 1\n');
}

function showDetailedInteraction(interaction, id) {
  console.log(`┌─ Interaction #${id} (DETAILED VIEW) ─────────────────`);
  console.log(`│ Timestamp: ${interaction.timestamp}`);
  console.log(`│ Source: ${interaction.source}`);
  console.log(`│ Conversation ID: ${interaction.conversation_id}`);
  console.log(`│`);
  console.log(`│ ▶ FULL PROMPT:`);
  console.log(`│`);

  // Show full prompt
  const promptLines = interaction.prompt_text.split('\n');
  promptLines.forEach(line => {
    console.log(`│   ${line}`);
  });

  console.log(`│`);
  console.log(`└────────────────────────────────────────────────────────\n`);

  // Show each edit in detail
  if (interaction.edits && interaction.edits.length > 0) {
    interaction.edits.forEach((edit, editIndex) => {
      console.log(`\n┌─ Edit #${editIndex + 1} ──────────────────────────────────────────`);
      console.log(`│ File: ${edit.file_path}`);
      console.log(`│ Source: ${edit.source}`);
      console.log(`│ Timestamp: ${edit.timestamp}`);
      console.log(`│`);

      if (edit.old_string || edit.new_string) {
        const oldLines = (edit.old_string || '').split('\n');
        const newLines = (edit.new_string || '').split('\n');

        console.log(`│ OLD CONTENT (${edit.old_string?.length || 0} chars, ${oldLines.length} lines):`);
        console.log(`│ ──────────────────────────────────────────────────────`);

        if (!edit.old_string) {
          console.log(`│   (new file - no previous content)`);
        } else if (oldLines.length > 50) {
          // Show first and last 20 lines
          console.log(`│   ... showing first 20 and last 20 lines of ${oldLines.length} total ...\n`);
          oldLines.slice(0, 20).forEach(line => {
            console.log(`│   ${line}`);
          });
          console.log(`│   ... (${oldLines.length - 40} lines omitted) ...`);
          oldLines.slice(-20).forEach(line => {
            console.log(`│   ${line}`);
          });
        } else {
          oldLines.forEach(line => {
            console.log(`│   ${line}`);
          });
        }

        console.log(`│`);
        console.log(`│ NEW CONTENT (${edit.new_string?.length || 0} chars, ${newLines.length} lines):`);
        console.log(`│ ──────────────────────────────────────────────────────`);

        if (newLines.length > 50) {
          console.log(`│   ... showing first 20 and last 20 lines of ${newLines.length} total ...\n`);
          newLines.slice(0, 20).forEach(line => {
            console.log(`│   ${line}`);
          });
          console.log(`│   ... (${newLines.length - 40} lines omitted) ...`);
          newLines.slice(-20).forEach(line => {
            console.log(`│   ${line}`);
          });
        } else {
          newLines.forEach(line => {
            console.log(`│   ${line}`);
          });
        }

        console.log(`│`);
        console.log(`│ DIFF SUMMARY:`);
        console.log(`│   Size change: ${(edit.new_string?.length || 0) - (edit.old_string?.length || 0)} characters`);
        console.log(`│   Line change: ${newLines.length - oldLines.length} lines`);
      }

      console.log(`└────────────────────────────────────────────────────────\n`);
    });
  } else {
    console.log('\nNo file edits in this interaction.\n');
  }
}

function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}
