#!/usr/bin/env node

/**
 * Analyze all prompts in the database and store quality scores
 */

const db = require('./database');
const analyzer = require('./prompt-analyzer');

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║           PROMPT QUALITY ANALYZER                             ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// Get all prompts from database
const prompts = db.db.prepare('SELECT * FROM prompts ORDER BY id').all();

if (prompts.length === 0) {
  console.log('❌ No prompts found in database.\n');
  console.log('   Make some interactions with Cursor/Claude Code first!\n');
  process.exit(0);
}

console.log(`Found ${prompts.length} prompt(s) to analyze...\n`);

let analyzed = 0;
let skipped = 0;

prompts.forEach((prompt, index) => {
  // Check if already analyzed
  const existing = db.getAnalysis(prompt.id);
  if (existing) {
    console.log(`⏭️  Skipping prompt #${prompt.id} (already analyzed)`);
    skipped++;
    return;
  }

  console.log(`\n📝 Analyzing prompt #${prompt.id}:`);
  console.log(`   "${prompt.prompt_text.substring(0, 60)}${prompt.prompt_text.length > 60 ? '...' : ''}"`);

  // Analyze the prompt
  const analysis = analyzer.analyzePrompt(prompt.prompt_text);

  // Store analysis in database
  db.logAnalysis(prompt.id, analysis);

  // Show results
  console.log(`   ✅ Overall Score: ${analysis.overall_score}/100`);
  console.log(`      - Specificity:     ${analysis.specificity_score}/100`);
  console.log(`      - Clarity:         ${analysis.clarity_score}/100`);
  console.log(`      - Technical Depth: ${analysis.technical_depth_score}/100`);
  console.log(`      - Actionability:   ${analysis.actionability_score}/100`);
  console.log(`      - Category:        ${analysis.category}`);
  console.log(`      - Technical Terms: ${analysis.technical_terms.length} found`);
  console.log(`      - File References: ${analysis.file_references.length} found`);

  if (analysis.improvement_suggestions) {
    console.log(`   💡 Suggestions: ${analysis.improvement_suggestions}`);
  }

  analyzed++;
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Analysis complete!`);
console.log(`   - Analyzed: ${analyzed}`);
console.log(`   - Skipped:  ${skipped}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Show summary statistics
const stats = db.db.prepare(`
  SELECT
    COUNT(*) as total,
    AVG(overall_score) as avg_score,
    MIN(overall_score) as min_score,
    MAX(overall_score) as max_score
  FROM prompt_analysis
`).get();

console.log('📊 Overall Statistics:');
console.log(`   Total Analyzed:   ${stats.total}`);
console.log(`   Average Score:    ${Math.round(stats.avg_score)}/100`);
console.log(`   Lowest Score:     ${stats.min_score}/100`);
console.log(`   Highest Score:    ${stats.max_score}/100\n`);

console.log('💡 Next steps:');
console.log('   - Run: node portfolio-report.js (to generate your portfolio)');
console.log('   - Run: node viewer.js (to view your prompts)');
console.log('   - Or query directly: sqlite3 cursor-interactions.db "SELECT * FROM prompt_analysis;"\n');
