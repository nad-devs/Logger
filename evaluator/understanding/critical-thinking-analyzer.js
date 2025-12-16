const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');
const { buildPrompt, parseResponse, getDefaultResponse } = require('../prompts/critical-thinking-prompt');

class CriticalThinkingAnalyzer {
  constructor(dbPath = path.join(__dirname, '../../cursor-interactions.db')) {
    this.db = new sqlite3.Database(dbPath);
    this.ollamaUrl = 'http://localhost:11434/api/generate';
    this.model = 'deepseek-r1:1.5b';
    this.timeout = 15000; // 15 seconds per prompt
  }

  async analyze(conversationId) {
    const prompts = await this.getConversationPrompts(conversationId);

    if (!prompts || prompts.length === 0) {
      return {
        score: 0,
        confidence: 0,
        verdict: 'uncertain',
        criticalQuestions: {
          count: 0,
          examples: [],
          quality: 0,
          breakdown: {},
          aiReasoning: []
        },
        analysisMethod: 'none',
        error: 'No prompts found'
      };
    }

    // AI-powered analysis of all prompts
    const aiAnalysis = await this.analyzeAllPromptsWithAI(prompts);

    // Calculate score from AI assessments
    const score = this.calculateScoreFromAI(aiAnalysis);
    const verdict = this.determineVerdict(score);
    const confidence = this.calculateConfidenceFromAI(aiAnalysis);

    return {
      score,
      confidence,
      verdict,
      criticalQuestions: aiAnalysis.criticalQuestions,
      analysisMethod: aiAnalysis.method,
      promptsAnalyzed: prompts.length,
      aiSuccessRate: aiAnalysis.successRate
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

  /**
   * AI-powered analysis of all prompts
   * Sends each prompt to DeepSeek for evaluation
   */
  async analyzeAllPromptsWithAI(prompts) {
    const analyses = [];
    let aiSuccessCount = 0;
    let fallbackCount = 0;

    for (const prompt of prompts) {
      const text = prompt.prompt_text;

      // Skip very short prompts (likely not meaningful)
      if (text.length < 10) {
        continue;
      }

      const analysis = await this.analyzePromptWithAI(text);

      if (analysis.parseError) {
        fallbackCount++;
      } else {
        aiSuccessCount++;
      }

      if (analysis.isCriticalThinking) {
        analyses.push({
          text: text,
          type: analysis.type,
          qualityScore: analysis.qualityScore,
          evidence: analysis.evidence,
          reasoning: analysis.reasoning,
          sequence: prompt.prompt_sequence_number
        });
      }
    }

    // Calculate breakdown by type
    const breakdown = {};
    for (const a of analyses) {
      breakdown[a.type] = (breakdown[a.type] || 0) + 1;
    }

    // Calculate average quality
    const avgQuality = analyses.length > 0
      ? analyses.reduce((sum, a) => sum + a.qualityScore, 0) / analyses.length
      : 0;

    return {
      criticalQuestions: {
        count: analyses.length,
        examples: analyses.slice(0, 5).map(a => a.text),
        quality: avgQuality,
        breakdown: breakdown,
        aiReasoning: analyses.slice(0, 5).map(a => ({
          prompt: a.text.substring(0, 100) + (a.text.length > 100 ? '...' : ''),
          type: a.type,
          score: a.qualityScore,
          evidence: a.evidence,
          reasoning: a.reasoning
        }))
      },
      allAnalyses: analyses,
      method: fallbackCount > aiSuccessCount ? 'fallback' : 'ai',
      successRate: prompts.length > 0 ? aiSuccessCount / prompts.length : 0
    };
  }

  /**
   * Send a single prompt to DeepSeek for analysis
   */
  async analyzePromptWithAI(promptText) {
    try {
      const prompt = buildPrompt(promptText);

      const response = await axios.post(this.ollamaUrl, {
        model: this.model,
        prompt: prompt,
        stream: false
      }, {
        timeout: this.timeout
      });

      const responseText = response.data.response;
      return parseResponse(responseText);

    } catch (error) {
      // Fallback to rule-based analysis
      return this.ruleBasedAnalysis(promptText);
    }
  }

  /**
   * Rule-based fallback when AI is unavailable
   * Uses regex patterns to detect critical thinking (legacy approach)
   */
  ruleBasedAnalysis(text) {
    const patterns = {
      tradeoff: [
        /why\s+(?:use|choose|pick|prefer)\s+\w+\s+(?:instead of|over|rather than)/i,
        /trade-?off/i,
        /pros and cons/i,
        /advantages and disadvantages/i
      ],
      security: [
        /security|vulnerable|injection|xss|csrf|authentication|authorization/i,
        /password|hash|encrypt|token/i
      ],
      edge_case: [
        /what\s+(?:if|happens|when)/i,
        /edge case|corner case|boundary/i,
        /error handling|exception/i
      ],
      architecture: [
        /scale|performance|optimize/i,
        /architecture|design pattern/i,
        /how\s+does\s+(?:this|that|it)\s+handle/i
      ],
      questioning_ai: [
        /wouldn't\s+this\s+(?:cause|create|lead to)/i,
        /could\s+(?:this|that)\s+(?:cause|lead to)/i,
        /are you sure|is this correct|shouldn't/i
      ]
    };

    let matchedType = 'none';
    let isCritical = false;

    for (const [type, typePatterns] of Object.entries(patterns)) {
      for (const pattern of typePatterns) {
        if (pattern.test(text)) {
          matchedType = type;
          isCritical = true;
          break;
        }
      }
      if (isCritical) break;
    }

    // Rule-based quality scoring
    let qualityScore = 0;
    if (isCritical) {
      qualityScore = 5; // baseline
      if (text.includes('trade-off') || text.includes('tradeoff')) qualityScore += 2;
      if (text.includes('security') || text.includes('performance')) qualityScore += 1;
      if (text.includes('instead of') || text.includes('rather than')) qualityScore += 1;
      if (text.length > 100) qualityScore += 1;
      qualityScore = Math.min(10, qualityScore);
    }

    return {
      isCriticalThinking: isCritical,
      type: matchedType,
      qualityScore: qualityScore,
      evidence: isCritical ? 'Matched regex pattern' : 'none',
      reasoning: isCritical
        ? `Rule-based: matched ${matchedType} pattern`
        : 'No critical thinking patterns detected',
      parseError: false,
      fallback: true
    };
  }

  /**
   * Calculate score from AI assessments
   * Weights quality scores and considers diversity of types
   */
  calculateScoreFromAI(aiAnalysis) {
    const { criticalQuestions, allAnalyses } = aiAnalysis;

    if (allAnalyses.length === 0) {
      return 0;
    }

    // Base score from count (0-4 points)
    let countScore = 0;
    if (criticalQuestions.count >= 5) {
      countScore = 4;
    } else if (criticalQuestions.count >= 3) {
      countScore = 3;
    } else if (criticalQuestions.count >= 1) {
      countScore = 2;
    }

    // Quality score (0-4 points) - average quality normalized
    const qualityScore = (criticalQuestions.quality / 10) * 4;

    // Diversity bonus (0-2 points) - different types of critical thinking
    const typeCount = Object.keys(criticalQuestions.breakdown).length;
    const diversityScore = Math.min(2, typeCount * 0.5);

    // Total score (0-10)
    const totalScore = Math.min(10, countScore + qualityScore + diversityScore);

    return Math.round(totalScore * 10) / 10;
  }

  determineVerdict(score) {
    if (score >= 7.5) return 'understands';
    if (score >= 5.0) return 'uncertain';
    return 'copy-paste';
  }

  /**
   * Calculate confidence based on AI analysis quality
   */
  calculateConfidenceFromAI(aiAnalysis) {
    const { criticalQuestions, successRate } = aiAnalysis;

    let confidence = 0.3; // baseline

    // Higher confidence with more critical questions found
    if (criticalQuestions.count >= 5) {
      confidence += 0.3;
    } else if (criticalQuestions.count >= 3) {
      confidence += 0.2;
    } else if (criticalQuestions.count >= 1) {
      confidence += 0.1;
    }

    // Higher confidence with diverse types
    const typeCount = Object.keys(criticalQuestions.breakdown).length;
    if (typeCount >= 3) {
      confidence += 0.2;
    } else if (typeCount >= 2) {
      confidence += 0.1;
    }

    // Higher confidence when AI analysis succeeded
    if (successRate > 0.8) {
      confidence += 0.15;
    } else if (successRate > 0.5) {
      confidence += 0.05;
    }

    return Math.min(0.95, Math.round(confidence * 100) / 100);
  }

  close() {
    this.db.close();
  }
}

module.exports = CriticalThinkingAnalyzer;
