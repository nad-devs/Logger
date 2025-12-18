const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');
const { buildPrompt, parseResponse } = require('../prompts/mistake-catcher-prompt');

class MistakeCatcherAnalyzer {
  constructor(dbPath = path.join(__dirname, '../../cursor-interactions.db')) {
    this.db = new sqlite3.Database(dbPath);
    this.ollamaUrl = 'http://localhost:11434/api/generate';
    this.model = 'deepseek-r1:1.5b';
    this.timeout = 15000;
  }

  async analyze(conversationId) {
    const prompts = await this.getConversationPrompts(conversationId);

    if (!prompts || prompts.length === 0) {
      return {
        score: 0,
        verdict: 'not_critical',
        mistakesCaught: {
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

    // AI-powered analysis
    const aiAnalysis = await this.analyzeAllPromptsWithAI(prompts);

    const score = this.calculateScoreFromAI(aiAnalysis);
    const verdict = this.determineVerdict(score);
    const confidence = this.calculateConfidenceFromAI(aiAnalysis);

    return {
      score,
      verdict,
      confidence,
      mistakesCaught: aiAnalysis.mistakesCaught,
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
   * AI-powered analysis of all prompts for mistake-catching
   */
  async analyzeAllPromptsWithAI(prompts) {
    const analyses = [];
    let aiSuccessCount = 0;
    let fallbackCount = 0;

    for (const prompt of prompts) {
      const text = prompt.prompt_text;

      if (text.length < 10) {
        continue;
      }

      const analysis = await this.analyzePromptWithAI(text);

      if (analysis.parseError) {
        fallbackCount++;
      } else {
        aiSuccessCount++;
      }

      // Only include instances where mistakes were caught
      if (analysis.caughtMistake) {
        analyses.push({
          text: text,
          type: analysis.mistakeType,
          severity: analysis.severity,
          qualityScore: analysis.qualityScore,
          evidence: analysis.evidence,
          reasoning: analysis.reasoning,
          sequence: prompt.prompt_sequence_number
        });
      }
    }

    // Calculate breakdown by type
    const typeBreakdown = {};
    const severityBreakdown = {};

    for (const a of analyses) {
      typeBreakdown[a.type] = (typeBreakdown[a.type] || 0) + 1;
      severityBreakdown[a.severity] = (severityBreakdown[a.severity] || 0) + 1;
    }

    // Calculate average quality
    const avgQuality = analyses.length > 0
      ? analyses.reduce((sum, a) => sum + a.qualityScore, 0) / analyses.length
      : 0;

    return {
      mistakesCaught: {
        count: analyses.length,
        examples: analyses.slice(0, 5).map(a => a.text),
        quality: avgQuality,
        breakdown: {
          byType: typeBreakdown,
          bySeverity: severityBreakdown
        },
        aiReasoning: analyses.slice(0, 5).map(a => ({
          prompt: a.text.substring(0, 100) + (a.text.length > 100 ? '...' : ''),
          type: a.type,
          severity: a.severity,
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
   * Send a single prompt to DeepSeek for mistake-catching analysis
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
      return this.ruleBasedAnalysis(promptText);
    }
  }

  /**
   * Rule-based fallback when AI is unavailable
   */
  ruleBasedAnalysis(text) {
    const patterns = {
      security: [
        /security|vulnerability|exploit|sql injection|xss|csrf/i,
        /authenticate|authorize|password|token|leak/i,
        /encrypt|hash|salt|sanitize|validate|escape/i
      ],
      bug: [
        /(?:this|that)\s+(?:has|contains)\s+(?:a\s+)?(?:bug|error|issue|problem)/i,
        /(?:this|that)\s+(?:doesn't|won't)\s+(?:work|handle)/i,
        /(?:I think|I believe)\s+(?:this|that)\s+(?:is|has)\s+(?:wrong|incorrect|broken)/i
      ],
      logic: [
        /wait,?\s+(?:this|that)/i,
        /(?:but|however)\s+(?:this|that)\s+(?:doesn't|won't|can't)/i
      ],
      edge_case: [
        /what\s+about\s+(?:edge case|corner case|boundary|null|undefined|empty)/i,
        /what\s+(?:if|happens)\s+(?:the|a|an)?.*(?:fails?|errors?|breaks?)/i
      ],
      prevention: [
        /(?:should|shouldn't|need to)\s+(?:handle|check|validate)/i,
        /(?:could|might)\s+(?:this|that)\s+(?:cause|lead to|result in)/i,
        /(?:missing|forgot|need to add)/i
      ]
    };

    let matchedType = 'none';
    let caughtMistake = false;
    let severity = 'none';
    let qualityScore = 0;

    // Check patterns
    for (const [type, typePatterns] of Object.entries(patterns)) {
      for (const pattern of typePatterns) {
        if (pattern.test(text)) {
          matchedType = type;
          caughtMistake = true;

          // Determine severity
          if (type === 'security') {
            severity = 'high';
            qualityScore = 8;
          } else if (type === 'bug' || type === 'logic') {
            severity = 'medium';
            qualityScore = 7;
          } else if (type === 'edge_case' || type === 'prevention') {
            severity = 'low';
            qualityScore = 6;
          }
          break;
        }
      }
      if (caughtMistake) break;
    }

    return {
      caughtMistake: caughtMistake,
      mistakeType: matchedType,
      severity: severity,
      qualityScore: qualityScore,
      evidence: caughtMistake ? 'Matched regex pattern' : 'none',
      reasoning: caughtMistake
        ? `Rule-based: matched ${matchedType} pattern`
        : 'No mistake-catching patterns detected',
      parseError: false,
      fallback: true
    };
  }

  /**
   * Calculate score from AI assessments
   */
  calculateScoreFromAI(aiAnalysis) {
    const { mistakesCaught, allAnalyses } = aiAnalysis;

    if (allAnalyses.length === 0) {
      return 0; // Blind acceptance
    }

    // Base score from count (0-4 points)
    let countScore = 0;
    if (mistakesCaught.count >= 5) {
      countScore = 4;
    } else if (mistakesCaught.count >= 3) {
      countScore = 3;
    } else if (mistakesCaught.count >= 1) {
      countScore = 2;
    }

    // Quality score (0-4 points)
    const qualityScore = (mistakesCaught.quality / 10) * 4;

    // Severity bonus (0-2 points) - reward catching high-severity issues
    const highSeverityCount = mistakesCaught.breakdown.bySeverity?.high || 0;
    const severityBonus = Math.min(2, highSeverityCount * 0.5);

    // Total score (0-10)
    const totalScore = Math.min(10, countScore + qualityScore + severityBonus);

    return Math.round(totalScore * 10) / 10;
  }

  determineVerdict(score) {
    if (score >= 8) return 'highly_critical';
    if (score >= 5) return 'somewhat_critical';
    return 'not_critical';
  }

  /**
   * Calculate confidence based on AI analysis quality
   */
  calculateConfidenceFromAI(aiAnalysis) {
    const { mistakesCaught, successRate } = aiAnalysis;

    let confidence = 0.3; // baseline

    // Higher confidence with more mistakes caught
    if (mistakesCaught.count >= 5) {
      confidence += 0.3;
    } else if (mistakesCaught.count >= 3) {
      confidence += 0.2;
    } else if (mistakesCaught.count >= 1) {
      confidence += 0.1;
    }

    // Higher confidence with high-severity catches
    const highSeverityCount = mistakesCaught.breakdown.bySeverity?.high || 0;
    if (highSeverityCount >= 2) {
      confidence += 0.2;
    } else if (highSeverityCount >= 1) {
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

module.exports = MistakeCatcherAnalyzer;
