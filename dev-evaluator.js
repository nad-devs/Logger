#!/usr/bin/env node

/**
 * Developer Evaluation Analyzer
 * Main entry point - orchestrates all analysis components
 */

const SemanticAnalyzer = require('./evaluator/semantic-analyzer');
const correlationEngine = require('./evaluator/correlation-engine');
const codePatternAnalyzer = require('./evaluator/code-pattern-analyzer');
const scoringEngine = require('./evaluator/scoring-engine');
const profileGenerator = require('./evaluator/profile-generator');

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║        DEVELOPER EVALUATION ANALYZER                          ║');
console.log('║        AI-Assisted Coding Session Analysis                    ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

async function runAnalysis() {
  const startTime = Date.now();

  // Step 1: Initialize semantic analyzer
  console.log('📋 Step 1: Initializing semantic analyzer...');
  const semanticAnalyzer = new SemanticAnalyzer(true);
  const ollamaStatus = await semanticAnalyzer.initialize();

  if (ollamaStatus.available && ollamaStatus.hasModel) {
    console.log('   ✅ Ollama available with DeepSeek model');
  } else if (ollamaStatus.available && !ollamaStatus.hasModel) {
    console.log('   ⚠️  Ollama available but DeepSeek model not found');
    console.log('   💡 Install with: ollama pull deepseek-r1:1.5b');
    console.log('   📝 Continuing with rule-based analysis only...');
  } else {
    console.log('   ⚠️  Ollama not available - using rule-based analysis only');
    console.log('   💡 Install Ollama: https://ollama.ai');
  }

  // Step 2: Correlate prompts to edits
  console.log('\n📊 Step 2: Correlating prompts to edits...');
  const correlations = correlationEngine.correlatePromptsToEdits();
  console.log(`   ✅ Analyzed ${correlations.length} prompts`);

  const effectiveness = correlationEngine.analyzeEffectiveness(correlations);
  console.log(`   📈 ${effectiveness.prompts_with_edits} prompts resulted in edits`);
  console.log(`   📉 ${effectiveness.prompts_without_edits} prompts had no edits`);

  // Step 3: Semantic analysis of prompts
  console.log('\n🧠 Step 3: Analyzing prompt quality...');
  const semanticAnalyses = [];
  for (let i = 0; i < correlations.length; i++) {
    const corr = correlations[i];
    process.stdout.write(`   Analyzing prompt ${i + 1}/${correlations.length}...\r`);

    const analysis = await semanticAnalyzer.analyzePrompt(corr.prompt_text, corr.prompt_id);
    semanticAnalyses.push(analysis);
  }
  console.log(`   ✅ Completed semantic analysis of ${semanticAnalyses.length} prompts`);

  // Step 4: Detect iteration patterns
  console.log('\n🔄 Step 4: Detecting iteration and reversal patterns...');
  const iterationPatterns = correlationEngine.detectIterationPatterns(correlations);
  console.log(`   ✅ Found ${iterationPatterns.length} files with multiple edits`);

  if (iterationPatterns.length > 0) {
    const withReversals = iterationPatterns.filter(p => p.has_reversals).length;
    if (withReversals > 0) {
      console.log(`   ⚠️  ${withReversals} files show code reversals (red flag)`);
    }
  }

  // Step 5: Analyze code patterns
  console.log('\n🎯 Step 5: Analyzing code change patterns...');
  const patternAnalysis = codePatternAnalyzer.analyzePatterns(correlations, iterationPatterns);
  console.log(`   ✅ Edit coherence score: ${patternAnalysis.edit_coherence.coherence_score}/100`);
  console.log(`   ✅ Iteration score: ${patternAnalysis.iteration_analysis.iteration_score}/100`);
  console.log(`   ✅ Reversal score: ${patternAnalysis.reversal_analysis.reversal_score}/100`);

  // Step 6: Detect anti-patterns and positive patterns
  console.log('\n🚩 Step 6: Detecting patterns...');
  const antiPatterns = codePatternAnalyzer.detectAntiPatterns(correlations, iterationPatterns);
  const positivePatterns = codePatternAnalyzer.detectPositivePatterns(correlations);
  console.log(`   🚫 ${antiPatterns.length} anti-patterns detected`);
  console.log(`   ✨ ${positivePatterns.length} positive patterns detected`);

  // Step 7: Calculate scores
  console.log('\n💯 Step 7: Calculating developer scores...');
  const scores = scoringEngine.calculateDeveloperScore({
    semanticAnalyses,
    correlations,
    patternAnalysis,
    antiPatterns,
    positivePatterns
  });
  console.log(`   ✅ Overall Score: ${scores.overall}/100`);

  // Step 8: Generate flags
  console.log('\n🏁 Step 8: Generating evaluation flags...');
  const redFlags = scoringEngine.generateRedFlags({
    antiPatterns,
    patternAnalysis,
    semanticAnalyses
  });
  const greenFlags = scoringEngine.generateGreenFlags({
    positivePatterns,
    patternAnalysis,
    semanticAnalyses
  });
  console.log(`   🚫 ${redFlags.length} red flags`);
  console.log(`   ✅ ${greenFlags.length} green flags`);

  // Step 9: Get assessment
  const assessment = scoringEngine.getAssessmentLevel(scores.overall);
  console.log(`\n🎓 Assessment: ${assessment.level} ${assessment.emoji}`);
  console.log(`   ${assessment.description}`);

  // Step 10: Generate developer profile
  console.log('\n👤 Step 9: Generating developer profile...');
  const profile = profileGenerator.generateProfile({
    scores,
    redFlags,
    greenFlags,
    semanticAnalyses,
    correlations,
    patternAnalysis,
    assessment
  });
  console.log(`   ✅ Profile generated`);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log(`\n✨ Analysis complete in ${duration}s`);

  // Return all data for report generation
  return {
    meta: profile.meta,
    scores,
    assessment,
    profile,
    redFlags,
    greenFlags,
    correlations,
    semanticAnalyses,
    patternAnalysis,
    antiPatterns,
    positivePatterns,
    effectiveness,
    iterationPatterns,
    analysis_duration: duration
  };
}

// Run analysis and export results
if (require.main === module) {
  runAnalysis()
    .then(results => {
      console.log('\n💾 Saving results to output/evaluation-data.json...');

      const fs = require('fs');
      const path = require('path');
      const outputDir = path.join(__dirname, 'output');

      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Save JSON
      fs.writeFileSync(
        path.join(outputDir, 'evaluation-data.json'),
        JSON.stringify(results, null, 2)
      );

      console.log('   ✅ Data saved');
      console.log('\n💡 Next step: Run evaluation-report.js to generate the report');
    })
    .catch(error => {
      console.error('\n❌ Analysis failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
} else {
  module.exports = { runAnalysis };
}
