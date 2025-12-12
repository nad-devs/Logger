/**
 * Semantic Analyzer
 * Enhanced prompt analysis using Ollama + rule-based metrics
 */

const ollamaClient = require('./ollama-client');

class SemanticAnalyzer {
  constructor(useOllama = true) {
    this.useOllama = useOllama;
    this.ollamaAvailable = false;
  }

  /**
   * Initialize and check Ollama availability
   */
  async initialize() {
    if (!this.useOllama) {
      return { available: false };
    }

    const status = await ollamaClient.checkAvailability();
    this.ollamaAvailable = status.available && status.hasModel;

    return status;
  }

  /**
   * Analyze a prompt with both rule-based and semantic analysis
   */
  async analyzePrompt(promptText, promptId) {
    const analysis = {
      prompt_id: promptId,
      prompt_text: promptText,
      rule_based_metrics: this.getRuleBasedMetrics(promptText),
      semantic_analysis: null,
      combined_insights: {}
    };

    // Try semantic analysis if Ollama is available
    if (this.ollamaAvailable) {
      try {
        analysis.semantic_analysis = await ollamaClient.analyzePromptIntent(promptText);
      } catch (error) {
        analysis.semantic_analysis = { error: error.message };
      }
    }

    // Combine insights
    analysis.combined_insights = this.combineInsights(
      analysis.rule_based_metrics,
      analysis.semantic_analysis
    );

    return analysis;
  }

  /**
   * Rule-based metrics (fast, always available)
   */
  getRuleBasedMetrics(promptText) {
    const text = promptText.toLowerCase();
    const words = promptText.split(/\s+/).filter(w => w.trim());

    return {
      word_count: words.length,
      char_count: promptText.length,
      has_question_mark: promptText.includes('?'),
      has_code_blocks: /`[^`]+`/.test(promptText),
      has_file_refs: /[\w-]+\.[\w]+/.test(promptText),
      has_numbers: /\d/.test(promptText),
      starts_with_action_verb: this.startsWithActionVerb(words[0]),
      vague_word_count: this.countVagueWords(text),
      technical_term_count: this.countTechnicalTerms(text),
      politeness_level: this.getPolitenessLevel(text),
      structure_type: this.getStructureType(promptText)
    };
  }

  /**
   * Check if first word is an action verb
   */
  startsWithActionVerb(firstWord) {
    if (!firstWord) return false;
    const actionVerbs = [
      'add', 'remove', 'update', 'fix', 'refactor', 'move', 'change',
      'create', 'delete', 'modify', 'implement', 'optimize', 'improve'
    ];
    return actionVerbs.includes(firstWord.toLowerCase());
  }

  /**
   * Count vague words
   */
  countVagueWords(text) {
    const vagueWords = ['this', 'that', 'it', 'something', 'stuff', 'thing',
                        'things', 'fix', 'help', 'better', 'good', 'bad'];
    let count = 0;
    vagueWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) count += matches.length;
    });
    return count;
  }

  /**
   * Count technical terms
   */
  countTechnicalTerms(text) {
    const terms = [
      'function', 'method', 'class', 'component', 'api', 'database',
      'async', 'await', 'refactor', 'test', 'error', 'validation'
    ];
    let count = 0;
    terms.forEach(term => {
      if (text.includes(term)) count++;
    });
    return count;
  }

  /**
   * Get politeness level (high politeness might indicate uncertainty)
   */
  getPolitenessLevel(text) {
    const politeWords = ['please', 'could you', 'would you', 'can you', 'thank'];
    let count = 0;
    politeWords.forEach(word => {
      if (text.includes(word)) count++;
    });
    return count >= 2 ? 'high' : count === 1 ? 'medium' : 'low';
  }

  /**
   * Get prompt structure type
   */
  getStructureType(text) {
    if (/^\d+\./.test(text)) return 'numbered_list';
    if (/^[-*]/.test(text)) return 'bullet_list';
    if (text.includes('\n')) return 'multi_line';
    return 'single_line';
  }

  /**
   * Combine rule-based and semantic insights
   */
  combineInsights(ruleMetrics, semanticAnalysis) {
    const insights = {
      confidence_score: 0,
      understanding_indicators: [],
      red_flags: [],
      green_flags: []
    };

    // Rule-based red flags
    if (ruleMetrics.word_count < 5) {
      insights.red_flags.push('Very short prompt - lacks detail');
    }
    if (ruleMetrics.vague_word_count >= 3) {
      insights.red_flags.push('High vague word usage - unclear intent');
    }
    if (ruleMetrics.politeness_level === 'high') {
      insights.red_flags.push('Overly polite - may indicate uncertainty');
    }
    if (ruleMetrics.has_question_mark && ruleMetrics.word_count < 10) {
      insights.red_flags.push('Vague question without context');
    }

    // Rule-based green flags
    if (ruleMetrics.has_file_refs) {
      insights.green_flags.push('References specific files');
    }
    if (ruleMetrics.starts_with_action_verb) {
      insights.green_flags.push('Clear action-oriented command');
    }
    if (ruleMetrics.technical_term_count >= 3) {
      insights.green_flags.push('Uses technical terminology');
    }
    if (ruleMetrics.structure_type !== 'single_line') {
      insights.green_flags.push('Well-structured prompt');
    }
    if (ruleMetrics.has_code_blocks) {
      insights.green_flags.push('Includes code examples');
    }

    // Semantic analysis insights
    if (semanticAnalysis && !semanticAnalysis.error) {
      if (semanticAnalysis.architectural_thinking) {
        insights.green_flags.push('Shows architectural thinking');
      }
      if (semanticAnalysis.shows_context_awareness) {
        insights.green_flags.push('Context-aware prompt');
      }
      if (semanticAnalysis.understanding_level === 'expert') {
        insights.green_flags.push('Expert-level understanding');
      }
      if (semanticAnalysis.understanding_level === 'confused') {
        insights.red_flags.push('Shows confusion or lack of understanding');
      }
      if (semanticAnalysis.specificity === 'vague') {
        insights.red_flags.push('Vague and non-specific');
      }
    }

    // Calculate confidence score
    const greenScore = insights.green_flags.length * 15;
    const redPenalty = insights.red_flags.length * 10;
    insights.confidence_score = Math.max(0, Math.min(100, 50 + greenScore - redPenalty));

    return insights;
  }

  /**
   * Compare two prompts for similarity/repetition
   */
  async comparePrompts(prompt1, prompt2) {
    if (!this.ollamaAvailable) {
      return this.basicCompare(prompt1, prompt2);
    }

    try {
      return await ollamaClient.comparePrompts(prompt1, prompt2);
    } catch (error) {
      return this.basicCompare(prompt1, prompt2);
    }
  }

  /**
   * Basic text comparison (fallback)
   */
  basicCompare(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    const similarity = Math.round((intersection.size / union.size) * 100);

    return {
      is_repetitive: similarity > 70,
      is_refinement: similarity > 40 && similarity < 70,
      similarity_score: similarity,
      shows_learning: false
    };
  }
}

module.exports = SemanticAnalyzer;
