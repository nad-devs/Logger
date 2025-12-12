/**
 * Code Pattern Analyzer
 * Analyzes code change patterns to assess developer understanding
 */

class CodePatternAnalyzer {
  /**
   * Analyze all edit patterns from correlations
   */
  analyzePatterns(correlations, iterationPatterns) {
    return {
      edit_coherence: this.analyzeEditCoherence(correlations),
      iteration_analysis: this.analyzeIterations(iterationPatterns),
      reversal_analysis: this.analyzeReversals(iterationPatterns),
      productivity_metrics: this.calculateProductivityMetrics(correlations),
      file_focus: this.analyzeFileFocus(correlations)
    };
  }

  /**
   * Analyze edit coherence (do edits make sense together?)
   */
  analyzeEditCoherence(correlations) {
    let coherentPrompts = 0;
    let incoherentPrompts = 0;
    let singleFileEdits = 0;
    let multiFileEdits = 0;
    let focusedEdits = 0;
    let scatteredEdits = 0;

    correlations.forEach(corr => {
      if (corr.stats.total_edits === 0) return;

      const filesChanged = corr.stats.files_changed;

      if (filesChanged === 1) {
        singleFileEdits++;
        coherentPrompts++;
      } else if (filesChanged <= 3) {
        multiFileEdits++;
        coherentPrompts++;
      } else {
        // Too many files changed in one prompt might indicate scatter
        scatteredEdits++;
        incoherentPrompts++;
      }

      // Check if edits are focused (low file count, reasonable edit count)
      if (filesChanged <= 2 && corr.stats.total_edits <= 5) {
        focusedEdits++;
      } else if (filesChanged >= 4 || corr.stats.total_edits > 10) {
        scatteredEdits++;
      }
    });

    const totalWithEdits = coherentPrompts + incoherentPrompts;
    const coherenceScore = totalWithEdits > 0
      ? Math.round((coherentPrompts / totalWithEdits) * 100)
      : 0;

    return {
      coherence_score: coherenceScore,
      coherent_prompts: coherentPrompts,
      incoherent_prompts: incoherentPrompts,
      single_file_edits: singleFileEdits,
      multi_file_edits: multiFileEdits,
      focused_edits: focusedEdits,
      scattered_edits: scatteredEdits,
      assessment: coherenceScore >= 70 ? 'good' : coherenceScore >= 50 ? 'moderate' : 'poor'
    };
  }

  /**
   * Analyze iteration patterns
   */
  analyzeIterations(iterationPatterns) {
    const totalIteratedFiles = iterationPatterns.length;
    const highIterationFiles = iterationPatterns.filter(p => p.edit_count >= 4).length;
    const moderateIterationFiles = iterationPatterns.filter(
      p => p.edit_count >= 2 && p.edit_count < 4
    ).length;

    // Calculate average iterations per file
    const avgIterations = totalIteratedFiles > 0
      ? (iterationPatterns.reduce((sum, p) => sum + p.edit_count, 0) / totalIteratedFiles).toFixed(2)
      : 0;

    // High iteration count might indicate trial-and-error or lack of understanding
    const iterationScore = totalIteratedFiles > 0
      ? Math.max(0, 100 - (highIterationFiles / totalIteratedFiles) * 50)
      : 100;

    return {
      total_iterated_files: totalIteratedFiles,
      high_iteration_files: highIterationFiles,
      moderate_iteration_files: moderateIterationFiles,
      avg_iterations_per_file: avgIterations,
      iteration_score: Math.round(iterationScore),
      red_flag: highIterationFiles >= 3,
      assessment: highIterationFiles >= 3
        ? 'excessive_iteration'
        : moderateIterationFiles > totalIteratedFiles / 2
        ? 'moderate_iteration'
        : 'healthy_iteration'
    };
  }

  /**
   * Analyze reversals (editing back and forth)
   */
  analyzeReversals(iterationPatterns) {
    const filesWithReversals = iterationPatterns.filter(p => p.has_reversals);
    const totalReversals = filesWithReversals.reduce(
      (sum, p) => sum + p.reversals.length,
      0
    );

    // Reversals are a strong red flag - indicates confusion or trial-and-error
    const reversalRate = iterationPatterns.length > 0
      ? (filesWithReversals.length / iterationPatterns.length) * 100
      : 0;

    const reversalScore = Math.max(0, 100 - (reversalRate * 2));

    return {
      files_with_reversals: filesWithReversals.length,
      total_reversals: totalReversals,
      reversal_rate: Math.round(reversalRate),
      reversal_score: Math.round(reversalScore),
      red_flag: filesWithReversals.length >= 2,
      details: filesWithReversals.map(f => ({
        file: f.file_path,
        reversals: f.reversals.length,
        timeline: f.timeline
      })),
      assessment: filesWithReversals.length >= 3
        ? 'high_confusion'
        : filesWithReversals.length >= 1
        ? 'some_uncertainty'
        : 'confident'
    };
  }

  /**
   * Calculate productivity metrics
   */
  calculateProductivityMetrics(correlations) {
    const withEdits = correlations.filter(c => c.stats.total_edits > 0);

    if (withEdits.length === 0) {
      return {
        avg_edits_per_prompt: 0,
        avg_files_per_prompt: 0,
        productivity_score: 0
      };
    }

    const totalEdits = withEdits.reduce((sum, c) => sum + c.stats.total_edits, 0);
    const totalFiles = withEdits.reduce((sum, c) => sum + c.stats.files_changed, 0);

    const avgEdits = (totalEdits / withEdits.length).toFixed(2);
    const avgFiles = (totalFiles / withEdits.length).toFixed(2);

    // Productivity score: balance between getting things done and not over-editing
    // Ideal: 2-4 edits per prompt, 1-2 files per prompt
    let productivityScore = 50;

    if (avgEdits >= 2 && avgEdits <= 4) productivityScore += 25;
    else if (avgEdits > 4) productivityScore -= 10; // Too many edits might indicate inefficiency

    if (avgFiles >= 1 && avgFiles <= 2) productivityScore += 25;
    else if (avgFiles > 3) productivityScore -= 10; // Too scattered

    return {
      avg_edits_per_prompt: avgEdits,
      avg_files_per_prompt: avgFiles,
      productivity_score: Math.max(0, Math.min(100, productivityScore)),
      assessment: productivityScore >= 70 ? 'efficient' : productivityScore >= 50 ? 'moderate' : 'inefficient'
    };
  }

  /**
   * Analyze file focus (are they working on the same files repeatedly?)
   */
  analyzeFileFocus(correlations) {
    const fileEditCount = {};

    correlations.forEach(corr => {
      corr.related_edits.forEach(edit => {
        fileEditCount[edit.file_path] = (fileEditCount[edit.file_path] || 0) + 1;
      });
    });

    const files = Object.keys(fileEditCount);
    const totalFiles = files.length;

    if (totalFiles === 0) {
      return {
        total_files_touched: 0,
        focus_score: 0,
        assessment: 'no_data'
      };
    }

    // Sort files by edit count
    const sortedFiles = files
      .map(f => ({ file: f, edits: fileEditCount[f] }))
      .sort((a, b) => b.edits - a.edits);

    // Calculate focus: are they concentrating on a few files or jumping around?
    const top3Files = sortedFiles.slice(0, 3);
    const top3EditCount = top3Files.reduce((sum, f) => sum + f.edits, 0);
    const totalEdits = sortedFiles.reduce((sum, f) => sum + f.edits, 0);

    const focusPercentage = (top3EditCount / totalEdits) * 100;

    // High focus (>70%) might indicate deep work on specific features
    // Low focus (<40%) might indicate jumping around without clear direction
    const focusScore = focusPercentage >= 70 ? 90 :
                       focusPercentage >= 50 ? 70 :
                       focusPercentage >= 30 ? 50 : 30;

    return {
      total_files_touched: totalFiles,
      top_files: top3Files,
      focus_percentage: Math.round(focusPercentage),
      focus_score: focusScore,
      assessment: focusPercentage >= 70
        ? 'highly_focused'
        : focusPercentage >= 50
        ? 'moderately_focused'
        : 'scattered'
    };
  }

  /**
   * Detect specific anti-patterns
   */
  detectAntiPatterns(correlations, iterationPatterns) {
    const antiPatterns = [];

    // Anti-pattern 1: Too many questions without implementation
    const questions = correlations.filter(c =>
      c.prompt_text.includes('?') && c.stats.total_edits === 0
    );
    if (questions.length >= 5) {
      antiPatterns.push({
        type: 'excessive_questions',
        severity: 'medium',
        count: questions.length,
        description: 'Many questions without implementation attempts',
        suggestion: 'Try implementing solutions before asking for guidance'
      });
    }

    // Anti-pattern 2: Repetitive vague prompts
    const vaguePrompts = correlations.filter(c =>
      c.prompt_text.length < 20 ||
      /^(fix|help|update|change) (this|that|it)/i.test(c.prompt_text)
    );
    if (vaguePrompts.length >= 5) {
      antiPatterns.push({
        type: 'vague_prompts',
        severity: 'high',
        count: vaguePrompts.length,
        description: 'Frequent vague or unclear prompts',
        suggestion: 'Be more specific about what you want to change and why'
      });
    }

    // Anti-pattern 3: High reversal rate
    const filesWithReversals = iterationPatterns.filter(p => p.has_reversals);
    if (filesWithReversals.length >= 3) {
      antiPatterns.push({
        type: 'frequent_reversals',
        severity: 'high',
        count: filesWithReversals.length,
        description: 'Frequently reverting code changes',
        suggestion: 'Understand requirements before implementing; use version control to track changes'
      });
    }

    // Anti-pattern 4: Excessive iteration on single files
    const excessiveIterations = iterationPatterns.filter(p => p.edit_count >= 5);
    if (excessiveIterations.length >= 2) {
      antiPatterns.push({
        type: 'excessive_iteration',
        severity: 'medium',
        count: excessiveIterations.length,
        description: 'Editing same files many times',
        suggestion: 'Plan changes before implementing; review code before submitting'
      });
    }

    return antiPatterns;
  }

  /**
   * Detect positive patterns (green flags)
   */
  detectPositivePatterns(correlations) {
    const positivePatterns = [];

    // Pattern 1: Architectural questions
    const architecturalPrompts = correlations.filter(c =>
      /architecture|design pattern|structure|refactor|organize|scalable|maintainable/i.test(c.prompt_text)
    );
    if (architecturalPrompts.length >= 2) {
      positivePatterns.push({
        type: 'architectural_thinking',
        count: architecturalPrompts.length,
        description: 'Shows architectural and design thinking',
        examples: architecturalPrompts.slice(0, 2).map(p => p.prompt_text.substring(0, 80))
      });
    }

    // Pattern 2: Testing mentions
    const testingPrompts = correlations.filter(c =>
      /test|spec|unit test|integration|coverage|assertion/i.test(c.prompt_text)
    );
    if (testingPrompts.length >= 2) {
      positivePatterns.push({
        type: 'testing_awareness',
        count: testingPrompts.length,
        description: 'Considers testing and code quality',
        examples: testingPrompts.slice(0, 2).map(p => p.prompt_text.substring(0, 80))
      });
    }

    // Pattern 3: Specific technical prompts
    const technicalPrompts = correlations.filter(c => {
      const text = c.prompt_text.toLowerCase();
      return c.prompt_text.length > 30 &&
             (text.includes('function') || text.includes('component') ||
              text.includes('api') || text.includes('method') ||
              /\w+\.\w+/.test(c.prompt_text)); // file.ext or method.property
    });
    if (technicalPrompts.length >= correlations.length * 0.6) {
      positivePatterns.push({
        type: 'technical_specificity',
        count: technicalPrompts.length,
        description: 'Uses specific technical language and references',
        percentage: Math.round((technicalPrompts.length / correlations.length) * 100)
      });
    }

    // Pattern 4: Improving prompt quality over time
    if (correlations.length >= 5) {
      const firstHalf = correlations.slice(0, Math.floor(correlations.length / 2));
      const secondHalf = correlations.slice(Math.floor(correlations.length / 2));

      const firstAvgLength = firstHalf.reduce((sum, c) => sum + c.prompt_text.length, 0) / firstHalf.length;
      const secondAvgLength = secondHalf.reduce((sum, c) => sum + c.prompt_text.length, 0) / secondHalf.length;

      if (secondAvgLength > firstAvgLength * 1.2) {
        positivePatterns.push({
          type: 'improving_specificity',
          description: 'Prompt quality improving over time (more detailed)',
          improvement: Math.round(((secondAvgLength - firstAvgLength) / firstAvgLength) * 100) + '%'
        });
      }
    }

    return positivePatterns;
  }
}

module.exports = new CodePatternAnalyzer();
