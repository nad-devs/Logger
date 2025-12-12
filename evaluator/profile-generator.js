/**
 * Developer Profile Generator
 * Creates a comprehensive developer understanding profile
 */

class ProfileGenerator {
  /**
   * Generate complete developer profile
   */
  generateProfile(data) {
    const {
      scores,
      redFlags,
      greenFlags,
      semanticAnalyses,
      correlations,
      patternAnalysis,
      assessment
    } = data;

    return {
      meta: this.generateMetadata(correlations),
      scores: scores,
      assessment: assessment,
      strengths: this.identifyStrengths(greenFlags, scores),
      weaknesses: this.identifyWeaknesses(redFlags, scores),
      work_style: this.analyzeWorkStyle(patternAnalysis, correlations),
      prompt_evolution: this.analyzePromptEvolution(semanticAnalyses, correlations),
      technical_profile: this.analyzeTechnicalProfile(semanticAnalyses, correlations),
      recommendations: this.generateRecommendations(redFlags, greenFlags, scores)
    };
  }

  /**
   * Generate metadata about the session
   */
  generateMetadata(correlations) {
    if (!correlations || correlations.length === 0) {
      return {
        total_prompts: 0,
        date_range: 'N/A',
        sources: []
      };
    }

    const sources = [...new Set(correlations.map(c => c.source))];
    const timestamps = correlations
      .map(c => new Date(c.prompt_timestamp))
      .sort((a, b) => a - b);

    const startDate = timestamps[0];
    const endDate = timestamps[timestamps.length - 1];
    const durationMs = endDate - startDate;
    const durationMinutes = Math.round(durationMs / 1000 / 60);

    return {
      total_prompts: correlations.length,
      total_edits: correlations.reduce((sum, c) => sum + c.stats.total_edits, 0),
      unique_files: new Set(
        correlations.flatMap(c => c.related_edits.map(e => e.file_path))
      ).size,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        duration_minutes: durationMinutes
      },
      sources: sources,
      session_type: durationMinutes < 30 ? 'short' : durationMinutes < 120 ? 'medium' : 'long'
    };
  }

  /**
   * Identify key strengths
   */
  identifyStrengths(greenFlags, scores) {
    const strengths = [];

    // From green flags
    if (greenFlags && greenFlags.length > 0) {
      greenFlags.forEach(flag => {
        strengths.push({
          area: flag.type,
          description: flag.description,
          evidence: flag.examples || flag.details,
          impact: 'positive'
        });
      });
    }

    // From high scores
    if (scores.prompt_quality >= 75) {
      strengths.push({
        area: 'prompt_quality',
        description: 'High-quality prompts with clear intent',
        score: scores.prompt_quality,
        impact: 'positive'
      });
    }

    if (scores.technical_depth >= 75) {
      strengths.push({
        area: 'technical_depth',
        description: 'Strong technical knowledge and terminology',
        score: scores.technical_depth,
        impact: 'positive'
      });
    }

    if (scores.self_sufficiency >= 75) {
      strengths.push({
        area: 'self_sufficiency',
        description: 'Works independently with minimal guidance',
        score: scores.self_sufficiency,
        impact: 'positive'
      });
    }

    return strengths;
  }

  /**
   * Identify key weaknesses
   */
  identifyWeaknesses(redFlags, scores) {
    const weaknesses = [];

    // From red flags
    if (redFlags && redFlags.length > 0) {
      redFlags.forEach(flag => {
        weaknesses.push({
          area: flag.type,
          severity: flag.severity,
          description: flag.description,
          suggestion: flag.suggestion,
          impact: 'negative'
        });
      });
    }

    // From low scores
    if (scores.prompt_quality < 50) {
      weaknesses.push({
        area: 'prompt_quality',
        severity: 'high',
        description: 'Prompts lack clarity and specificity',
        score: scores.prompt_quality,
        impact: 'negative',
        suggestion: 'Learn to write clear, specific prompts with context'
      });
    }

    if (scores.understanding < 50) {
      weaknesses.push({
        area: 'code_understanding',
        severity: 'high',
        description: 'Shows limited understanding of the code',
        score: scores.understanding,
        impact: 'negative',
        suggestion: 'Review and understand code before making changes'
      });
    }

    if (scores.code_coherence < 50) {
      weaknesses.push({
        area: 'code_coherence',
        severity: 'medium',
        description: 'Edit patterns show confusion or trial-and-error',
        score: scores.code_coherence,
        impact: 'negative',
        suggestion: 'Plan changes before implementing'
      });
    }

    return weaknesses;
  }

  /**
   * Analyze work style
   */
  analyzeWorkStyle(patternAnalysis, correlations) {
    if (!patternAnalysis || !correlations) {
      return { style: 'unknown', characteristics: [] };
    }

    const characteristics = [];
    let style = 'balanced';

    // Analyze pace
    const promptsPerHour = this.calculatePromptsPerHour(correlations);
    if (promptsPerHour > 10) {
      characteristics.push('Fast-paced, iterative approach');
      style = 'rapid_iteration';
    } else if (promptsPerHour < 3) {
      characteristics.push('Deliberate, thoughtful approach');
      style = 'methodical';
    }

    // Analyze focus
    if (patternAnalysis.file_focus) {
      if (patternAnalysis.file_focus.assessment === 'highly_focused') {
        characteristics.push('Highly focused on specific files/features');
      } else if (patternAnalysis.file_focus.assessment === 'scattered') {
        characteristics.push('Jumps between multiple files/features');
        style = 'exploratory';
      }
    }

    // Analyze iteration patterns
    if (patternAnalysis.iteration_analysis) {
      if (patternAnalysis.iteration_analysis.assessment === 'excessive_iteration') {
        characteristics.push('Frequent trial-and-error approach');
        style = 'trial_and_error';
      } else if (patternAnalysis.iteration_analysis.assessment === 'healthy_iteration') {
        characteristics.push('Balanced iteration and refinement');
      }
    }

    // Analyze productivity
    if (patternAnalysis.productivity_metrics) {
      if (patternAnalysis.productivity_metrics.assessment === 'efficient') {
        characteristics.push('Efficient workflow with minimal waste');
      } else if (patternAnalysis.productivity_metrics.assessment === 'inefficient') {
        characteristics.push('Inefficient with redundant edits');
      }
    }

    return {
      style: style,
      characteristics: characteristics,
      productivity: patternAnalysis.productivity_metrics
    };
  }

  /**
   * Calculate prompts per hour
   */
  calculatePromptsPerHour(correlations) {
    if (!correlations || correlations.length < 2) return 0;

    const timestamps = correlations.map(c => new Date(c.prompt_timestamp).getTime());
    const start = Math.min(...timestamps);
    const end = Math.max(...timestamps);
    const durationHours = (end - start) / 1000 / 60 / 60;

    return durationHours > 0 ? correlations.length / durationHours : 0;
  }

  /**
   * Analyze prompt evolution over time
   */
  analyzePromptEvolution(semanticAnalyses, correlations) {
    if (!correlations || correlations.length < 5) {
      return {
        trend: 'insufficient_data',
        improvement: false,
        details: 'Not enough data to analyze evolution'
      };
    }

    // Split into thirds
    const third = Math.floor(correlations.length / 3);
    const early = correlations.slice(0, third);
    const mid = correlations.slice(third, third * 2);
    const late = correlations.slice(third * 2);

    const earlyAvgLength = early.reduce((sum, c) => sum + c.prompt_text.length, 0) / early.length;
    const midAvgLength = mid.reduce((sum, c) => sum + c.prompt_text.length, 0) / mid.length;
    const lateAvgLength = late.reduce((sum, c) => sum + c.prompt_text.length, 0) / late.length;

    const improving = lateAvgLength > earlyAvgLength * 1.1;
    const declining = lateAvgLength < earlyAvgLength * 0.9;

    let trend = 'stable';
    if (improving) trend = 'improving';
    if (declining) trend = 'declining';

    return {
      trend: trend,
      improvement: improving,
      early_avg_length: Math.round(earlyAvgLength),
      late_avg_length: Math.round(lateAvgLength),
      change_percentage: Math.round(((lateAvgLength - earlyAvgLength) / earlyAvgLength) * 100),
      details: improving
        ? 'Prompts becoming more detailed over time'
        : declining
        ? 'Prompts becoming less detailed over time'
        : 'Prompt quality remains consistent'
    };
  }

  /**
   * Analyze technical profile
   */
  analyzeTechnicalProfile(semanticAnalyses, correlations) {
    const profile = {
      domains: [],
      technologies: new Set(),
      concepts: new Set(),
      expertise_areas: []
    };

    if (!semanticAnalyses || !correlations) {
      return profile;
    }

    // Extract technologies and concepts from prompts
    const allText = correlations.map(c => c.prompt_text.toLowerCase()).join(' ');

    // Common technologies
    const techs = ['react', 'node', 'python', 'typescript', 'javascript', 'css', 'html',
                   'sql', 'mongodb', 'express', 'vue', 'angular', 'django', 'flask'];
    techs.forEach(tech => {
      if (allText.includes(tech)) profile.technologies.add(tech);
    });

    // Common concepts
    const concepts = ['api', 'database', 'authentication', 'testing', 'component',
                      'function', 'async', 'state', 'props', 'hooks', 'routing'];
    concepts.forEach(concept => {
      if (allText.includes(concept)) profile.concepts.add(concept);
    });

    // Categorize expertise
    if (allText.includes('test') || allText.includes('spec')) {
      profile.expertise_areas.push('Testing');
    }
    if (allText.includes('api') || allText.includes('endpoint')) {
      profile.expertise_areas.push('API Development');
    }
    if (allText.includes('component') || allText.includes('ui')) {
      profile.expertise_areas.push('UI Development');
    }
    if (allText.includes('database') || allText.includes('query')) {
      profile.expertise_areas.push('Database');
    }

    // Determine domains
    const frontendKeywords = ['component', 'ui', 'css', 'html', 'react', 'vue', 'angular'];
    const backendKeywords = ['api', 'database', 'server', 'endpoint', 'authentication'];
    const testingKeywords = ['test', 'spec', 'unit', 'integration'];

    const frontendCount = frontendKeywords.filter(k => allText.includes(k)).length;
    const backendCount = backendKeywords.filter(k => allText.includes(k)).length;
    const testingCount = testingKeywords.filter(k => allText.includes(k)).length;

    if (frontendCount >= 2) profile.domains.push('Frontend');
    if (backendCount >= 2) profile.domains.push('Backend');
    if (testingCount >= 2) profile.domains.push('Testing');
    if (frontendCount >= 2 && backendCount >= 2) profile.domains.push('Full-Stack');

    return {
      domains: profile.domains,
      technologies: Array.from(profile.technologies),
      concepts: Array.from(profile.concepts),
      expertise_areas: profile.expertise_areas
    };
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(redFlags, greenFlags, scores) {
    const recommendations = [];

    // Based on red flags
    if (redFlags && redFlags.length > 0) {
      redFlags.forEach(flag => {
        if (flag.suggestion) {
          recommendations.push({
            priority: flag.severity === 'high' ? 'critical' : 'important',
            area: flag.type,
            recommendation: flag.suggestion
          });
        }
      });
    }

    // Based on low scores
    if (scores.prompt_quality < 60) {
      recommendations.push({
        priority: 'important',
        area: 'prompt_quality',
        recommendation: 'Study examples of effective prompts. Be specific about files, functions, and desired outcomes.'
      });
    }

    if (scores.understanding < 60) {
      recommendations.push({
        priority: 'critical',
        area: 'understanding',
        recommendation: 'Take time to understand the code before making changes. Read documentation and review similar implementations.'
      });
    }

    if (scores.self_sufficiency < 60) {
      recommendations.push({
        priority: 'important',
        area: 'self_sufficiency',
        recommendation: 'Try to solve problems independently before asking for help. Research error messages and documentation first.'
      });
    }

    // Positive reinforcement
    if (greenFlags && greenFlags.length >= 3) {
      recommendations.push({
        priority: 'positive',
        area: 'strengths',
        recommendation: 'Continue leveraging your strengths in ' +
          greenFlags.map(f => f.type).slice(0, 2).join(' and ')
      });
    }

    return recommendations;
  }
}

module.exports = new ProfileGenerator();
