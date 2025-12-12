#!/usr/bin/env node

/**
 * Evaluation Report Generator
 * Generates interviewer-friendly reports in JSON and Markdown formats
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');
const DATA_FILE = path.join(OUTPUT_DIR, 'evaluation-data.json');

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║        EVALUATION REPORT GENERATOR                            ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// Load analysis data
if (!fs.existsSync(DATA_FILE)) {
  console.error('❌ Error: evaluation-data.json not found');
  console.error('   Run dev-evaluator.js first to generate the data');
  process.exit(1);
}

console.log('📖 Loading analysis data...');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
console.log('   ✅ Data loaded\n');

// Generate Markdown Report
function generateMarkdownReport(data) {
  const { scores, assessment, profile, redFlags, greenFlags, meta, effectiveness } = data;

  let md = '';

  // Header
  md += '# Developer Evaluation Report\n\n';
  md += '**AI-Assisted Coding Session Analysis**\n\n';
  md += `*Generated: ${new Date().toISOString()}*\n\n`;
  md += '---\n\n';

  // Executive Summary
  md += '## Executive Summary\n\n';
  md += `**Overall Assessment: ${assessment.level}** ${assessment.emoji}\n\n`;
  md += `**Overall Score: ${scores.overall}/100**\n\n`;
  md += `${assessment.description}\n\n`;
  md += `**Recommendation:** ${assessment.recommendation}\n\n`;
  md += '---\n\n';

  // Session Metadata
  md += '## Session Overview\n\n';
  md += `- **Total Prompts:** ${meta.total_prompts}\n`;
  md += `- **Total Edits:** ${meta.total_edits}\n`;
  md += `- **Files Touched:** ${meta.unique_files}\n`;
  md += `- **Sources:** ${meta.sources.join(', ')}\n`;
  md += `- **Session Duration:** ${meta.date_range.duration_minutes} minutes\n`;
  md += `- **Session Type:** ${meta.session_type}\n\n`;

  // Score Breakdown
  md += '## Score Breakdown\n\n';
  md += '| Category | Score | Assessment |\n';
  md += '|----------|-------|------------|\n';
  md += `| Prompt Quality | ${scores.prompt_quality}/100 | ${getScoreEmoji(scores.prompt_quality)} |\n`;
  md += `| Self-Sufficiency | ${scores.self_sufficiency}/100 | ${getScoreEmoji(scores.self_sufficiency)} |\n`;
  md += `| Technical Depth | ${scores.technical_depth}/100 | ${getScoreEmoji(scores.technical_depth)} |\n`;
  md += `| Code Coherence | ${scores.code_coherence}/100 | ${getScoreEmoji(scores.code_coherence)} |\n`;
  md += `| Understanding | ${scores.understanding}/100 | ${getScoreEmoji(scores.understanding)} |\n`;
  md += `| **Overall** | **${scores.overall}/100** | **${getScoreEmoji(scores.overall)}** |\n\n`;

  // Red Flags
  if (redFlags.length > 0) {
    md += '## 🚩 Red Flags\n\n';
    md += `Found ${redFlags.length} concerning pattern(s):\n\n`;

    redFlags.forEach((flag, i) => {
      md += `### ${i + 1}. ${flag.type.replace(/_/g, ' ').toUpperCase()}\n\n`;
      md += `**Severity:** ${flag.severity.toUpperCase()}\n\n`;
      md += `**Description:** ${flag.description}\n\n`;
      md += `**Suggestion:** ${flag.suggestion}\n\n`;
    });
  } else {
    md += '## ✅ No Red Flags\n\n';
    md += 'No concerning patterns detected.\n\n';
  }

  // Green Flags
  if (greenFlags.length > 0) {
    md += '## ✨ Green Flags\n\n';
    md += `Found ${greenFlags.length} positive pattern(s):\n\n`;

    greenFlags.forEach((flag, i) => {
      md += `### ${i + 1}. ${flag.type.replace(/_/g, ' ').toUpperCase()}\n\n`;
      md += `**Description:** ${flag.description}\n\n`;
      if (flag.examples) {
        md += `**Examples:**\n`;
        flag.examples.slice(0, 2).forEach(ex => {
          md += `- "${ex}"\n`;
        });
        md += '\n';
      }
    });
  }

  // Strengths
  if (profile.strengths && profile.strengths.length > 0) {
    md += '## 💪 Key Strengths\n\n';
    profile.strengths.forEach(strength => {
      md += `- **${strength.area.replace(/_/g, ' ')}**: ${strength.description}\n`;
    });
    md += '\n';
  }

  // Weaknesses
  if (profile.weaknesses && profile.weaknesses.length > 0) {
    md += '## ⚠️ Areas for Improvement\n\n';
    profile.weaknesses.forEach(weakness => {
      md += `- **${weakness.area.replace(/_/g, ' ')}** (${weakness.severity}): ${weakness.description}\n`;
      if (weakness.suggestion) {
        md += `  - *Suggestion: ${weakness.suggestion}*\n`;
      }
    });
    md += '\n';
  }

  // Work Style
  if (profile.work_style) {
    md += '## 🎨 Work Style\n\n';
    md += `**Style:** ${profile.work_style.style.replace(/_/g, ' ')}\n\n`;
    if (profile.work_style.characteristics && profile.work_style.characteristics.length > 0) {
      md += '**Characteristics:**\n';
      profile.work_style.characteristics.forEach(char => {
        md += `- ${char}\n`;
      });
      md += '\n';
    }
  }

  // Prompt Evolution
  if (profile.prompt_evolution) {
    md += '## 📈 Prompt Evolution\n\n';
    md += `**Trend:** ${profile.prompt_evolution.trend}\n\n`;
    md += `${profile.prompt_evolution.details}\n\n`;
    if (profile.prompt_evolution.change_percentage) {
      md += `Change: ${profile.prompt_evolution.change_percentage > 0 ? '+' : ''}${profile.prompt_evolution.change_percentage}%\n\n`;
    }
  }

  // Technical Profile
  if (profile.technical_profile) {
    md += '## 🛠️ Technical Profile\n\n';

    if (profile.technical_profile.domains && profile.technical_profile.domains.length > 0) {
      md += `**Domains:** ${profile.technical_profile.domains.join(', ')}\n\n`;
    }

    if (profile.technical_profile.technologies && profile.technical_profile.technologies.length > 0) {
      md += `**Technologies:** ${profile.technical_profile.technologies.join(', ')}\n\n`;
    }

    if (profile.technical_profile.expertise_areas && profile.technical_profile.expertise_areas.length > 0) {
      md += `**Expertise Areas:** ${profile.technical_profile.expertise_areas.join(', ')}\n\n`;
    }
  }

  // Recommendations
  if (profile.recommendations && profile.recommendations.length > 0) {
    md += '## 💡 Recommendations\n\n';

    const critical = profile.recommendations.filter(r => r.priority === 'critical');
    const important = profile.recommendations.filter(r => r.priority === 'important');
    const positive = profile.recommendations.filter(r => r.priority === 'positive');

    if (critical.length > 0) {
      md += '### Critical\n\n';
      critical.forEach(rec => {
        md += `- **${rec.area.replace(/_/g, ' ')}**: ${rec.recommendation}\n`;
      });
      md += '\n';
    }

    if (important.length > 0) {
      md += '### Important\n\n';
      important.forEach(rec => {
        md += `- **${rec.area.replace(/_/g, ' ')}**: ${rec.recommendation}\n`;
      });
      md += '\n';
    }

    if (positive.length > 0) {
      md += '### Positive Reinforcement\n\n';
      positive.forEach(rec => {
        md += `- ${rec.recommendation}\n`;
      });
      md += '\n';
    }
  }

  // Effectiveness Metrics
  md += '## 📊 Effectiveness Metrics\n\n';
  md += `- **Prompts resulting in edits:** ${effectiveness.prompts_with_edits} / ${effectiveness.total_prompts} (${effectiveness.effectiveness_score}%)\n`;
  md += `- **Average edits per prompt:** ${effectiveness.avg_edits_per_prompt}\n`;
  md += `- **Average files per prompt:** ${effectiveness.avg_files_per_prompt}\n\n`;

  // Footer
  md += '---\n\n';
  md += `*Report generated by Developer Evaluation Analyzer v1.0*\n`;
  md += `*Analysis duration: ${data.analysis_duration}s*\n`;

  return md;
}

// Generate summary JSON for quick review
function generateSummaryJSON(data) {
  const { scores, assessment, profile, redFlags, greenFlags, meta } = data;

  return {
    version: '1.0',
    generated_at: new Date().toISOString(),
    assessment: {
      level: assessment.level,
      overall_score: scores.overall,
      recommendation: assessment.recommendation
    },
    scores: scores,
    session: {
      total_prompts: meta.total_prompts,
      total_edits: meta.total_edits,
      files_touched: meta.unique_files,
      duration_minutes: meta.date_range.duration_minutes
    },
    flags: {
      red_flags: redFlags.length,
      green_flags: greenFlags.length,
      red_flag_details: redFlags.map(f => ({
        type: f.type,
        severity: f.severity,
        description: f.description
      })),
      green_flag_details: greenFlags.map(f => ({
        type: f.type,
        description: f.description
      }))
    },
    strengths: profile.strengths?.map(s => s.area) || [],
    weaknesses: profile.weaknesses?.map(w => ({ area: w.area, severity: w.severity })) || [],
    work_style: profile.work_style?.style || 'unknown',
    technical_profile: profile.technical_profile
  };
}

// Helper function to get score emoji
function getScoreEmoji(score) {
  if (score >= 85) return '⭐⭐⭐⭐⭐ Excellent';
  if (score >= 70) return '⭐⭐⭐⭐ Good';
  if (score >= 55) return '⭐⭐⭐ Fair';
  if (score >= 40) return '⭐⭐ Poor';
  return '⭐ Critical';
}

// Main execution
console.log('📝 Generating Markdown report...');
const markdown = generateMarkdownReport(data);
const mdPath = path.join(OUTPUT_DIR, 'evaluation-report.md');
fs.writeFileSync(mdPath, markdown);
console.log(`   ✅ Saved to: ${mdPath}\n`);

console.log('📄 Generating summary JSON...');
const summary = generateSummaryJSON(data);
const jsonPath = path.join(OUTPUT_DIR, 'evaluation-summary.json');
fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
console.log(`   ✅ Saved to: ${jsonPath}\n`);

console.log('✨ Report generation complete!\n');
console.log('📂 Output files:');
console.log(`   - ${mdPath}`);
console.log(`   - ${jsonPath}`);
console.log(`   - ${DATA_FILE}`);
console.log('\n💡 Open evaluation-report.md to view the full report\n');
