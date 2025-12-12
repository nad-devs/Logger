/**
 * Scoring Engine
 * Calculates overall developer evaluation scores based on all analysis
 */

class ScoringEngine {
  /**
   * Calculate comprehensive developer score
   */
  calculateDeveloperScore(data) {
    const {
      semanticAnalyses,
      correlations,
      patternAnalysis,
      antiPatterns,
      positivePatterns
    } = data;

    const scores = {
      prompt_quality: this.scorePromptQuality(semanticAnalyses),
      self_sufficiency: this.scoreSelfSufficiency(correlations, semanticAnalyses),
      technical_depth: this.scoreTechnicalDepth(semanticAnalyses, positivePatterns),
      code_coherence: this.scoreCodeCoherence(patternAnalysis),
      understanding: this.scoreUnderstanding(antiPatterns, positivePatterns, patternAnalysis),
      overall: 0
    };

    // Calculate weighted overall score
    scores.overall = Math.round(
      scores.prompt_quality * 0.20 +
      scores.self_sufficiency * 0.20 +
      scores.technical_depth * 0.20 +
      scores.code_coherence * 0.20 +
      scores.understanding * 0.20
    );

    return scores;
  }

  /**
   * Score prompt quality
   */
  scorePromptQuality(semanticAnalyses) {
    if (!semanticAnalyses || semanticAnalyses.length === 0) return 50;

    let totalConfidence = 0;
    let totalGreenFlags = 0;
    let totalRedFlags = 0;

    semanticAnalyses.forEach(analysis => {
      if (analysis.combined_insights) {
        totalConfidence += analysis.combined_insights.confidence_score || 0;
        totalGreenFlags += analysis.combined_insights.green_flags?.length || 0;
        totalRedFlags += analysis.combined_insights.red_flags?.length || 0;
      }
    });

    const avgConfidence = totalConfidence / semanticAnalyses.length;
    const flagRatio = totalRedFlags > 0 ? totalGreenFlags / totalRedFlags : totalGreenFlags;

    // Combine confidence and flag ratio
    let score = avgConfidence * 0.7 + Math.min(flagRatio * 10, 30);

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Score self-sufficiency (can they work independently?)
   */
  scoreSelfSufficiency(correlations, semanticAnalyses) {
    if (!correlations || correlations.length === 0) return 50;

    let score = 60; // Start at moderate

    // Count question prompts
    const questions = correlations.filter(c => c.prompt_text.includes('?'));
    const questionRate = (questions.length / correlations.length) * 100;

    // Too many questions = low self-sufficiency
    if (questionRate > 50) score -= 30;
    else if (questionRate > 30) score -= 15;
    else if (questionRate < 20) score += 10;

    // Count prompts that resulted in action (edits)
    const actionablePrompts = correlations.filter(c => c.stats.total_edits > 0);
    const actionRate = (actionablePrompts.length / correlations.length) * 100;

    // High action rate = more self-sufficient
    if (actionRate >= 70) score += 20;
    else if (actionRate >= 50) score += 10;
    else if (actionRate < 30) score -= 15;

    // Check for "help" or "please" patterns (uncertainty)
    const helpPrompts = correlations.filter(c =>
      /^(help|please|can you|could you|how do i)/i.test(c.prompt_text)
    );
    const helpRate = (helpPrompts.length / correlations.length) * 100;

    if (helpRate > 40) score -= 20;
    else if (helpRate < 20) score += 10;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Score technical depth
   */
  scoreTechnicalDepth(semanticAnalyses, positivePatterns) {
    let score = 50;

    // Check semantic analysis for technical depth
    if (semanticAnalyses && semanticAnalyses.length > 0) {
      const technicalPrompts = semanticAnalyses.filter(a =>
        a.rule_based_metrics?.technical_term_count >= 2
      );
      const techRate = (technicalPrompts.length / semanticAnalyses.length) * 100;

      if (techRate >= 60) score += 25;
      else if (techRate >= 40) score += 15;
      else if (techRate < 20) score -= 15;

      // Check for file references (shows specificity)
      const fileRefPrompts = semanticAnalyses.filter(a =>
        a.rule_based_metrics?.has_file_refs
      );
      const fileRefRate = (fileRefPrompts.length / semanticAnalyses.length) * 100;

      if (fileRefRate >= 50) score += 15;
      else if (fileRefRate >= 30) score += 10;
    }

    // Bonus for positive patterns
    if (positivePatterns) {
      if (positivePatterns.some(p => p.type === 'architectural_thinking')) score += 15;
      if (positivePatterns.some(p => p.type === 'testing_awareness')) score += 10;
      if (positivePatterns.some(p => p.type === 'technical_specificity')) score += 10;
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Score code coherence (do their changes make sense?)
   */
  scoreCodeCoherence(patternAnalysis) {
    if (!patternAnalysis) return 50;

    let score = 50;

    // Edit coherence
    if (patternAnalysis.edit_coherence) {
      score = patternAnalysis.edit_coherence.coherence_score * 0.4;

      // Bonus for focused edits
      if (patternAnalysis.edit_coherence.focused_edits > patternAnalysis.edit_coherence.scattered_edits) {
        score += 15;
      }
    }

    // Iteration penalty
    if (patternAnalysis.iteration_analysis) {
      score += patternAnalysis.iteration_analysis.iteration_score * 0.3;
    }

    // Reversal penalty (strong negative signal)
    if (patternAnalysis.reversal_analysis) {
      score += patternAnalysis.reversal_analysis.reversal_score * 0.3;

      if (patternAnalysis.reversal_analysis.red_flag) {
        score -= 20; // Heavy penalty for reversals
      }
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Score overall understanding
   */
  scoreUnderstanding(antiPatterns, positivePatterns, patternAnalysis) {
    let score = 60; // Start at moderate

    // Anti-patterns are strong negative signals
    if (antiPatterns && antiPatterns.length > 0) {
      antiPatterns.forEach(pattern => {
        if (pattern.severity === 'high') score -= 15;
        else if (pattern.severity === 'medium') score -= 10;
        else score -= 5;
      });
    }

    // Positive patterns are strong positive signals
    if (positivePatterns && positivePatterns.length > 0) {
      positivePatterns.forEach(pattern => {
        if (pattern.type === 'architectural_thinking') score += 15;
        else if (pattern.type === 'testing_awareness') score += 12;
        else if (pattern.type === 'improving_specificity') score += 10;
        else score += 8;
      });
    }

    // Productivity matters
    if (patternAnalysis?.productivity_metrics) {
      const prodScore = patternAnalysis.productivity_metrics.productivity_score;
      score += (prodScore - 50) * 0.2; // Adjust based on productivity
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Generate red flags report
   */
  generateRedFlags(data) {
    const flags = [];
    const { antiPatterns, patternAnalysis, semanticAnalyses } = data;

    // From anti-patterns
    if (antiPatterns) {
      antiPatterns.forEach(pattern => {
        flags.push({
          category: 'anti_pattern',
          severity: pattern.severity,
          type: pattern.type,
          description: pattern.description,
          count: pattern.count,
          suggestion: pattern.suggestion
        });
      });
    }

    // From reversal analysis
    if (patternAnalysis?.reversal_analysis?.red_flag) {
      flags.push({
        category: 'code_pattern',
        severity: 'high',
        type: 'frequent_reversals',
        description: `${patternAnalysis.reversal_analysis.files_with_reversals} files with code reversals`,
        suggestion: 'Indicates confusion or trial-and-error approach. Plan changes before implementing.'
      });
    }

    // From iteration analysis
    if (patternAnalysis?.iteration_analysis?.red_flag) {
      flags.push({
        category: 'code_pattern',
        severity: 'medium',
        type: 'excessive_iteration',
        description: `${patternAnalysis.iteration_analysis.high_iteration_files} files edited 4+ times`,
        suggestion: 'Multiple iterations suggest unclear requirements or approach. Review before coding.'
      });
    }

    // From semantic analysis
    if (semanticAnalyses) {
      const confusedPrompts = semanticAnalyses.filter(a =>
        a.semantic_analysis?.understanding_level === 'confused'
      );
      if (confusedPrompts.length >= 3) {
        flags.push({
          category: 'prompt_quality',
          severity: 'medium',
          type: 'confusion_indicators',
          description: `${confusedPrompts.length} prompts show confusion or uncertainty`,
          suggestion: 'Take time to understand requirements before asking AI for help.'
        });
      }
    }

    // Sort by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    flags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return flags;
  }

  /**
   * Generate green flags report
   */
  generateGreenFlags(data) {
    const flags = [];
    const { positivePatterns, patternAnalysis, semanticAnalyses } = data;

    // From positive patterns
    if (positivePatterns) {
      positivePatterns.forEach(pattern => {
        flags.push({
          category: 'positive_pattern',
          type: pattern.type,
          description: pattern.description,
          count: pattern.count,
          examples: pattern.examples
        });
      });
    }

    // From file focus
    if (patternAnalysis?.file_focus?.assessment === 'highly_focused') {
      flags.push({
        category: 'work_pattern',
        type: 'focused_work',
        description: 'Highly focused on specific files, indicating deep work on features',
        details: `${patternAnalysis.file_focus.focus_percentage}% of edits on top 3 files`
      });
    }

    // From productivity
    if (patternAnalysis?.productivity_metrics?.assessment === 'efficient') {
      flags.push({
        category: 'productivity',
        type: 'efficient_workflow',
        description: 'Efficient edit patterns with minimal redundancy',
        details: patternAnalysis.productivity_metrics
      });
    }

    // From semantic analysis
    if (semanticAnalyses) {
      const expertPrompts = semanticAnalyses.filter(a =>
        a.semantic_analysis?.understanding_level === 'expert'
      );
      if (expertPrompts.length >= 2) {
        flags.push({
          category: 'expertise',
          type: 'expert_level_prompts',
          description: `${expertPrompts.length} prompts show expert-level understanding`,
          examples: expertPrompts.slice(0, 2).map(a => a.prompt_text.substring(0, 80))
        });
      }
    }

    return flags;
  }

  /**
   * Determine overall assessment level
   */
  getAssessmentLevel(overallScore) {
    if (overallScore >= 85) {
      return {
        level: 'Expert',
        emoji: '⭐⭐⭐⭐⭐',
        description: 'Demonstrates strong understanding and effective AI collaboration',
        recommendation: 'Strong hire - shows mastery of AI-assisted development'
      };
    } else if (overallScore >= 70) {
      return {
        level: 'Proficient',
        emoji: '⭐⭐⭐⭐',
        description: 'Good understanding with minor areas for improvement',
        recommendation: 'Good candidate - shows competence with room to grow'
      };
    } else if (overallScore >= 55) {
      return {
        level: 'Developing',
        emoji: '⭐⭐⭐',
        description: 'Moderate understanding, needs improvement in some areas',
        recommendation: 'Consider for junior roles - needs mentorship'
      };
    } else if (overallScore >= 40) {
      return {
        level: 'Novice',
        emoji: '⭐⭐',
        description: 'Limited understanding, relies heavily on AI without comprehension',
        recommendation: 'Weak candidate - significant gaps in understanding'
      };
    } else {
      return {
        level: 'Concerning',
        emoji: '⭐',
        description: 'Shows confusion and trial-and-error without learning',
        recommendation: 'Not recommended - does not understand the code being written'
      };
    }
  }
}

module.exports = new ScoringEngine();
