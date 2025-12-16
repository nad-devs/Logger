const CriticalThinkingAnalyzer = require('./evaluator/understanding/critical-thinking-analyzer');
const MistakeCatcherAnalyzer = require('./evaluator/understanding/mistake-catcher-analyzer');
const DebuggingReasoningAnalyzer = require('./evaluator/understanding/debugging-reasoning-analyzer');
const ModificationAnalyzer = require('./evaluator/understanding/modification-analyzer');
const ContextAnalyzer = require('./evaluator/understanding/context-analyzer');

async function testAllAnalyzers(conversationId) {
  console.log('='.repeat(60));
  console.log('UNDERSTANDING ANALYZERS TEST');
  console.log('='.repeat(60));
  console.log(`Conversation ID: ${conversationId}\n`);

  try {
    // Test 1: Critical Thinking Analyzer (AI-Powered)
    console.log('1. CRITICAL THINKING ANALYZER (AI-Powered)');
    console.log('-'.repeat(60));
    const criticalThinking = new CriticalThinkingAnalyzer();
    const ctResult = await criticalThinking.analyze(conversationId);
    console.log(`Score: ${ctResult.score.toFixed(1)}/10`);
    console.log(`Verdict: ${ctResult.verdict}`);
    console.log(`Confidence: ${(ctResult.confidence * 100).toFixed(0)}%`);
    console.log(`Critical Questions Found: ${ctResult.criticalQuestions.count}`);
    console.log(`Average Quality: ${ctResult.criticalQuestions.quality.toFixed(1)}/10`);
    console.log(`Analysis Method: ${ctResult.analysisMethod}`);
    console.log(`AI Success Rate: ${(ctResult.aiSuccessRate * 100).toFixed(0)}%`);
    if (ctResult.criticalQuestions.breakdown && Object.keys(ctResult.criticalQuestions.breakdown).length > 0) {
      console.log('Type Breakdown:');
      for (const [type, count] of Object.entries(ctResult.criticalQuestions.breakdown)) {
        console.log(`  - ${type}: ${count}`);
      }
    }
    if (ctResult.criticalQuestions.examples && ctResult.criticalQuestions.examples.length > 0) {
      console.log('\nExample Critical Questions:');
      ctResult.criticalQuestions.examples.slice(0, 2).forEach((ex, i) => {
        console.log(`  ${i + 1}. ${ex.substring(0, 100)}...`);
      });
    }
    criticalThinking.close();

    // Test 2: AI Mistake Catcher Analyzer
    console.log('\n2. AI MISTAKE CATCHER ANALYZER');
    console.log('-'.repeat(60));
    const mistakeCatcher = new MistakeCatcherAnalyzer();
    const mcResult = await mistakeCatcher.analyze(conversationId);
    console.log(`Score: ${mcResult.score.toFixed(1)}/10`);
    console.log(`Verdict: ${mcResult.verdict}`);
    console.log(`Caught Mistakes: ${mcResult.caughtMistakes.count}`);
    console.log(`Security Issues Found: ${mcResult.securityIssuesFound.count}`);
    console.log(`Bugs Foreseen: ${mcResult.bugsForeseen.count}`);
    if (mcResult.caughtMistakes.examples.length > 0) {
      console.log('\nExample Caught Mistakes:');
      mcResult.caughtMistakes.examples.slice(0, 2).forEach((ex, i) => {
        console.log(`  ${i + 1}. ${ex.substring(0, 100)}...`);
      });
    }
    mistakeCatcher.close();

    // Test 3: Debugging Reasoning Analyzer
    console.log('\n3. DEBUGGING REASONING ANALYZER');
    console.log('-'.repeat(60));
    const debuggingReasoning = new DebuggingReasoningAnalyzer();
    const drResult = await debuggingReasoning.analyze(conversationId);
    console.log(`Score: ${drResult.score.toFixed(1)}/10`);
    console.log(`Verdict: ${drResult.verdict}`);
    console.log(`Hypothesis Formation: ${drResult.hypothesisFormation.count}`);
    console.log(`Systematic Approach Score: ${drResult.systematicApproach.score}/10`);
    console.log(`Root Cause Analysis: ${drResult.rootCauseAnalysis.count}`);
    console.log(`Debugging Sessions: ${drResult.debuggingSessionCount}`);
    console.log(`Debugging Prompts: ${drResult.debuggingPromptCount}`);
    if (drResult.hypothesisFormation.examples.length > 0) {
      console.log('\nExample Hypotheses:');
      drResult.hypothesisFormation.examples.slice(0, 2).forEach((ex, i) => {
        console.log(`  ${i + 1}. ${ex.substring(0, 100)}...`);
      });
    }
    debuggingReasoning.close();

    // Test 4: Code Modification Analyzer
    console.log('\n4. CODE MODIFICATION ANALYZER');
    console.log('-'.repeat(60));
    const modification = new ModificationAnalyzer();
    const modResult = await modification.analyze(conversationId);
    console.log(`Score: ${modResult.score.toFixed(1)}/10`);
    console.log(`Verdict: ${modResult.verdict}`);
    console.log(`Modification Rate: ${(modResult.modificationRate * 100).toFixed(1)}%`);
    console.log(`Modification Quality: ${modResult.modificationQuality.toFixed(1)}/10`);
    console.log(`Blind Acceptance Rate: ${(modResult.blindAcceptanceRate * 100).toFixed(1)}%`);
    console.log(`Total Edits: ${modResult.totalEdits}`);
    modification.close();

    // Test 5: Contextual Awareness Analyzer
    console.log('\n5. CONTEXTUAL AWARENESS ANALYZER');
    console.log('-'.repeat(60));
    const context = new ContextAnalyzer();
    const contextResult = await context.analyze(conversationId);
    console.log(`Score: ${contextResult.score.toFixed(1)}/10`);
    console.log(`Verdict: ${contextResult.verdict}`);
    console.log(`Context References: ${contextResult.contextReferences.count}`);
    console.log(`Knowledge Building Score: ${contextResult.knowledgeBuilding.score.toFixed(1)}/10`);
    console.log(`Architecture Awareness Score: ${contextResult.architectureAwareness.score.toFixed(1)}/10`);
    if (contextResult.contextReferences.examples.length > 0) {
      console.log('\nExample Context References:');
      contextResult.contextReferences.examples.slice(0, 2).forEach((ex, i) => {
        console.log(`  ${i + 1}. ${ex.substring(0, 100)}...`);
      });
    }
    context.close();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('OVERALL SUMMARY');
    console.log('='.repeat(60));
    const overallScore = (
      ctResult.score +
      mcResult.score +
      drResult.score +
      modResult.score +
      contextResult.score
    ) / 5;

    console.log(`Average Score: ${overallScore.toFixed(1)}/10`);
    console.log('\nIndividual Scores:');
    console.log(`  Critical Thinking:     ${ctResult.score.toFixed(1)}/10 (${ctResult.verdict})`);
    console.log(`  Mistake Catching:      ${mcResult.score.toFixed(1)}/10 (${mcResult.verdict})`);
    console.log(`  Debugging Reasoning:   ${drResult.score.toFixed(1)}/10 (${drResult.verdict})`);
    console.log(`  Code Modification:     ${modResult.score.toFixed(1)}/10 (${modResult.verdict})`);
    console.log(`  Contextual Awareness:  ${contextResult.score.toFixed(1)}/10 (${contextResult.verdict})`);

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error(error.stack);
  }
}

// Get conversation ID from command line or use default
const conversationId = process.argv[2];

if (!conversationId) {
  console.error('Usage: node test-understanding-analyzers.js <conversation_id>');
  process.exit(1);
}

testAllAnalyzers(conversationId);
