/**
 * Test script to compare OLD (regex-based) vs NEW (AI-powered) Critical Thinking Analyzer
 *
 * Usage: node test-ai-analyzer-comparison.js <conversation_id>
 */

const CriticalThinkingAnalyzer = require('./evaluator/understanding/critical-thinking-analyzer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Legacy analyzer implementation for comparison
class LegacyCriticalThinkingAnalyzer {
  constructor(dbPath = path.join(__dirname, 'cursor-interactions.db')) {
    this.db = new sqlite3.Database(dbPath);
  }

  async analyze(conversationId) {
    const prompts = await this.getConversationPrompts(conversationId);

    if (!prompts || prompts.length === 0) {
      return {
        score: 0,
        confidence: 0,
        verdict: 'uncertain',
        criticalQuestions: { count: 0, examples: [], quality: 0 },
        tradeoffDiscussions: { count: 0, examples: [] },
        whyQuestions: { count: 0, ratio: 0 },
        edgeCaseConsideration: { count: 0, examples: [] },
        error: 'No prompts found'
      };
    }

    const criticalQuestions = this.detectCriticalQuestions(prompts);
    const tradeoffDiscussions = this.detectTradeoffThinking(prompts);
    const whyQuestions = this.detectWhyQuestions(prompts);
    const edgeCaseConsideration = this.detectEdgeCaseThinking(prompts);

    const score = this.calculateScore({
      criticalQuestions,
      tradeoffDiscussions,
      whyQuestions,
      edgeCaseConsideration
    });

    const verdict = this.determineVerdict(score);
    const confidence = this.calculateConfidence({
      criticalQuestions,
      tradeoffDiscussions,
      whyQuestions,
      edgeCaseConsideration
    });

    return {
      score,
      confidence,
      verdict,
      criticalQuestions,
      tradeoffDiscussions,
      whyQuestions,
      edgeCaseConsideration
    };
  }

  async getConversationPrompts(conversationId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM prompts WHERE conversation_id = ? ORDER BY prompt_sequence_number`,
        [conversationId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  detectCriticalQuestions(prompts) {
    const patterns = [
      /why\s+(?:use|choose|pick|prefer)\s+(\w+)\s+(?:instead of|over|rather than)\s+(\w+)/i,
      /what\s+are\s+(?:the\s+)?(?:trade-?offs?|pros and cons|advantages and disadvantages)/i,
      /wouldn't\s+this\s+(?:cause|create|lead to|result in)/i,
      /how\s+does\s+(?:this|that|it)\s+handle/i,
      /what\s+happens\s+(?:if|when)/i,
      /why\s+(?:is|does|would)/i,
      /could\s+(?:this|that)\s+(?:cause|lead to|result in)/i
    ];

    const criticalPrompts = [];

    for (const prompt of prompts) {
      const text = prompt.prompt_text;
      let isCritical = false;
      let matchedPattern = null;

      for (const pattern of patterns) {
        if (pattern.test(text)) {
          isCritical = true;
          matchedPattern = pattern.toString();
          break;
        }
      }

      if (isCritical) {
        criticalPrompts.push({
          text,
          quality: this.ruleBasedQualityScore(text),
          pattern: matchedPattern
        });
      }
    }

    return {
      count: criticalPrompts.length,
      examples: criticalPrompts.slice(0, 5).map(p => p.text),
      quality: criticalPrompts.length > 0
        ? criticalPrompts.reduce((sum, p) => sum + p.quality, 0) / criticalPrompts.length
        : 0
    };
  }

  ruleBasedQualityScore(text) {
    let score = 5;
    if (text.includes('trade-off') || text.includes('tradeoff')) score += 2;
    if (text.includes('security') || text.includes('performance')) score += 1;
    if (text.includes('instead of') || text.includes('rather than')) score += 1;
    if (text.includes('edge case') || text.includes('corner case')) score += 1;
    if (text.includes('scale') || text.includes('production')) score += 1;
    if (text.length > 100) score += 1;
    return Math.min(10, score);
  }

  detectTradeoffThinking(prompts) {
    const tradeoffKeywords = [
      'trade-off', 'tradeoff', 'pros and cons', 'advantages and disadvantages',
      'downside', 'drawback', 'benefit vs', 'cost vs', 'versus'
    ];

    const tradeoffPrompts = prompts.filter(prompt => {
      const text = prompt.prompt_text.toLowerCase();
      return tradeoffKeywords.some(keyword => text.includes(keyword));
    });

    return {
      count: tradeoffPrompts.length,
      examples: tradeoffPrompts.slice(0, 3).map(p => p.prompt_text)
    };
  }

  detectWhyQuestions(prompts) {
    const whyCount = prompts.filter(p => /\bwhy\b/i.test(p.prompt_text)).length;
    const howCount = prompts.filter(p => /\bhow\b/i.test(p.prompt_text)).length;
    const totalQuestions = prompts.filter(p => p.is_question).length;
    const ratio = totalQuestions > 0 ? whyCount / totalQuestions : 0;

    return { count: whyCount, ratio, howCount, totalQuestions };
  }

  detectEdgeCaseThinking(prompts) {
    const edgeCaseKeywords = [
      'edge case', 'corner case', 'what if', 'what happens when',
      'boundary', 'limit', 'exception', 'failure', 'error handling'
    ];

    const edgeCasePrompts = prompts.filter(prompt => {
      const text = prompt.prompt_text.toLowerCase();
      return edgeCaseKeywords.some(keyword => text.includes(keyword));
    });

    return {
      count: edgeCasePrompts.length,
      examples: edgeCasePrompts.slice(0, 3).map(p => p.prompt_text)
    };
  }

  calculateScore({ criticalQuestions, tradeoffDiscussions, whyQuestions, edgeCaseConsideration }) {
    let score = 0;
    if (criticalQuestions.count >= 5) score += 10;
    else if (criticalQuestions.count >= 3) score += 7;
    else if (criticalQuestions.count >= 1) score += 4;

    if (tradeoffDiscussions.count > 0) score += 2;
    if (whyQuestions.ratio > 0.5) score += 1;
    if (edgeCaseConsideration.count >= 3) score += 2;
    else if (edgeCaseConsideration.count >= 1) score += 1;

    return Math.min(10, (score / 15) * 10);
  }

  determineVerdict(score) {
    if (score >= 7.5) return 'understands';
    if (score >= 5.0) return 'uncertain';
    return 'copy-paste';
  }

  calculateConfidence({ criticalQuestions, tradeoffDiscussions, whyQuestions, edgeCaseConsideration }) {
    let indicators = 0;
    if (criticalQuestions.count >= 3) indicators++;
    if (tradeoffDiscussions.count >= 1) indicators++;
    if (whyQuestions.ratio > 0.3) indicators++;
    if (edgeCaseConsideration.count >= 2) indicators++;

    const confidenceMap = { 0: 0.3, 1: 0.5, 2: 0.7, 3: 0.85, 4: 0.95 };
    return confidenceMap[indicators] || 0.3;
  }

  close() {
    this.db.close();
  }
}

async function runComparison(conversationId) {
  console.log('='.repeat(70));
  console.log('CRITICAL THINKING ANALYZER COMPARISON');
  console.log('OLD (Regex-based) vs NEW (AI-powered)');
  console.log('='.repeat(70));
  console.log(`\nConversation ID: ${conversationId}\n`);

  try {
    // Run legacy analyzer
    console.log('Running LEGACY analyzer (regex-based)...');
    const legacy = new LegacyCriticalThinkingAnalyzer();
    const legacyResult = await legacy.analyze(conversationId);
    legacy.close();

    // Run new AI-powered analyzer
    console.log('Running NEW analyzer (AI-powered)...');
    const newAnalyzer = new CriticalThinkingAnalyzer();
    const newResult = await newAnalyzer.analyze(conversationId);
    newAnalyzer.close();

    // Display comparison
    console.log('\n' + '='.repeat(70));
    console.log('RESULTS COMPARISON');
    console.log('='.repeat(70));

    console.log('\n--- SCORES ---');
    console.log(`LEGACY Score:  ${legacyResult.score.toFixed(1)}/10 (${legacyResult.verdict})`);
    console.log(`NEW Score:     ${newResult.score.toFixed(1)}/10 (${newResult.verdict})`);
    console.log(`Difference:    ${(newResult.score - legacyResult.score).toFixed(1)} points`);

    console.log('\n--- CONFIDENCE ---');
    console.log(`LEGACY Confidence: ${(legacyResult.confidence * 100).toFixed(0)}%`);
    console.log(`NEW Confidence:    ${(newResult.confidence * 100).toFixed(0)}%`);

    console.log('\n--- CRITICAL QUESTIONS DETECTED ---');
    console.log(`LEGACY found: ${legacyResult.criticalQuestions.count} (via regex patterns)`);
    console.log(`NEW found:    ${newResult.criticalQuestions.count} (via AI analysis)`);

    if (newResult.criticalQuestions.breakdown) {
      console.log('\n--- NEW ANALYZER TYPE BREAKDOWN ---');
      for (const [type, count] of Object.entries(newResult.criticalQuestions.breakdown)) {
        console.log(`  ${type}: ${count}`);
      }
    }

    console.log('\n--- ANALYSIS METHOD ---');
    console.log(`NEW used: ${newResult.analysisMethod} (${(newResult.aiSuccessRate * 100).toFixed(0)}% AI success rate)`);

    // Show AI reasoning for detected critical thinking
    if (newResult.criticalQuestions.aiReasoning && newResult.criticalQuestions.aiReasoning.length > 0) {
      console.log('\n--- AI REASONING (Top 3) ---');
      newResult.criticalQuestions.aiReasoning.slice(0, 3).forEach((item, i) => {
        console.log(`\n${i + 1}. "${item.prompt}"`);
        console.log(`   Type: ${item.type} | Score: ${item.score}/10`);
        console.log(`   Evidence: ${item.evidence}`);
        console.log(`   Reasoning: ${item.reasoning}`);
      });
    }

    // Show what legacy found
    if (legacyResult.criticalQuestions.examples.length > 0) {
      console.log('\n--- LEGACY DETECTED (via regex) ---');
      legacyResult.criticalQuestions.examples.slice(0, 3).forEach((ex, i) => {
        console.log(`${i + 1}. "${ex.substring(0, 80)}..."`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    const improvement = newResult.score > legacyResult.score;
    const same = Math.abs(newResult.score - legacyResult.score) < 0.5;

    if (same) {
      console.log('VERDICT: Scores are similar - both approaches agree on this conversation');
    } else if (improvement) {
      console.log('VERDICT: NEW analyzer found MORE critical thinking than regex patterns');
      console.log('         AI likely detected nuanced understanding that regex missed');
    } else {
      console.log('VERDICT: NEW analyzer found LESS critical thinking than regex patterns');
      console.log('         AI may have identified surface-level questions regex accepted');
    }

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error(error.stack);
  }
}

// Get conversation ID from command line
const conversationId = process.argv[2];

if (!conversationId) {
  console.error('Usage: node test-ai-analyzer-comparison.js <conversation_id>');
  console.error('\nAvailable conversation IDs:');

  // List available conversations
  const db = new sqlite3.Database(path.join(__dirname, 'cursor-interactions.db'));
  db.all(
    `SELECT conversation_id, COUNT(*) as prompt_count FROM prompts GROUP BY conversation_id ORDER BY prompt_count DESC LIMIT 10`,
    [],
    (err, rows) => {
      if (!err && rows) {
        rows.forEach(row => {
          console.error(`  ${row.conversation_id} (${row.prompt_count} prompts)`);
        });
      }
      db.close();
      process.exit(1);
    }
  );
} else {
  runComparison(conversationId);
}
