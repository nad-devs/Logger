const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');
const { buildPrompt, parseResponse } = require('../prompts/debugging-reasoning-prompt');

class DebuggingReasoningAnalyzer {
  constructor(dbPath = path.join(__dirname, '../../cursor-interactions.db')) {
    this.db = new sqlite3.Database(dbPath);
    this.ollamaUrl = 'http://localhost:11434/api/generate';
    this.model = 'deepseek-r1:1.5b';
    this.timeout = 15000;
  }

  async analyze(conversationId) {
    const debuggingSessions = await this.getDebuggingSessions(conversationId);
    const prompts = await this.getConversationPrompts(conversationId);

    if (!prompts || prompts.length === 0) {
      return {
        score: 0,
        verdict: 'helpless',
        systematicDebugging: {
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

    // Filter debugging prompts (or analyze all if none marked as debugging)
    const debuggingPrompts = prompts.filter(p => p.is_debugging);
    const promptsToAnalyze = debuggingPrompts.length > 0 ? debuggingPrompts : prompts;

    // AI-powered analysis
    const aiAnalysis = await this.analyzeAllPromptsWithAI(promptsToAnalyze);

    const score = this.calculateScoreFromAI(aiAnalysis);
    const verdict = this.determineVerdict(score);
    const confidence = this.calculateConfidenceFromAI(aiAnalysis);

    return {
      score,
      verdict,
      confidence,
      systematicDebugging: aiAnalysis.systematicDebugging,
      analysisMethod: aiAnalysis.method,
      debuggingSessionCount: debuggingSessions.length,
      debuggingPromptCount: promptsToAnalyze.length,
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

  async getDebuggingSessions(conversationId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM debugging_sessions WHERE conversation_id = ?`,
        [conversationId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * AI-powered analysis of all prompts for debugging reasoning
   */
  async analyzeAllPromptsWithAI(prompts) {
    const analyses = [];
    let aiSuccessCount = 0;
    let fallbackCount = 0;

    for (const prompt of prompts) {
      const text = prompt.prompt_text;

      // Skip very short prompts
      if (text.length < 10) {
        continue;
      }

      const analysis = await this.analyzePromptWithAI(text);

      if (analysis.parseError) {
        fallbackCount++;
      } else {
        aiSuccessCount++;
      }

      // Only include systematic debugging instances
      if (analysis.isSystematic) {
        analyses.push({
          text: text,
          type: analysis.type,
          qualityScore: analysis.debuggingQuality,
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
      systematicDebugging: {
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
   * Send a single prompt to DeepSeek for debugging analysis
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
   */
  ruleBasedAnalysis(text) {
    const patterns = {
      hypothesis: [
        /I think\s+(?:the\s+)?(?:issue|problem|bug|error)\s+is/i,
        /(?:probably|likely|maybe)\s+(?:caused by|due to|because)/i,
        /the\s+error\s+suggests/i,
        /(?:I believe|I suspect)\s+(?:the|this|it)/i
      ],
      testing: [
        /I (?:tested|tried|checked)/i,
        /(?:first|then|next)\s+I/i,
        /step\s+\d+/i,
        /I'll\s+(?:start by|begin with)/i
      ],
      root_cause: [
        /root\s+cause/i,
        /caused\s+by/i,
        /the\s+reason\s+(?:is|was)/i,
        /underlying\s+(?:issue|problem)/i
      ],
      narrowing: [
        /narrowed\s+(?:it\s+)?down\s+to/i,
        /isolated\s+(?:the\s+)?(?:issue|problem|bug)/i,
        /ruled\s+out/i,
        /eliminated/i
      ],
      trial_error: [
        /try\s+(?:this|that)\??/i,
        /(?:still|doesn't)\s+(?:not\s+)?work/i,
        /(?:what|how)\s+about/i
      ]
    };

    let matchedType = 'helpless';
    let isSystematic = false;
    let qualityScore = 0;

    // Check for systematic patterns first
    for (const [type, typePatterns] of Object.entries(patterns)) {
      if (type === 'trial_error') continue; // Skip trial_error in systematic check

      for (const pattern of typePatterns) {
        if (pattern.test(text)) {
          matchedType = type;
          isSystematic = true;
          qualityScore = 6; // baseline for systematic

          // Bonus for strong indicators
          if (type === 'root_cause') qualityScore += 2;
          if (type === 'narrowing') qualityScore += 1;
          if (text.length > 100) qualityScore += 1;

          qualityScore = Math.min(10, qualityScore);
          break;
        }
      }
      if (isSystematic) break;
    }

    // If no systematic patterns, check for trial_error
    if (!isSystematic) {
      for (const pattern of patterns.trial_error) {
        if (pattern.test(text)) {
          matchedType = 'trial_error';
          qualityScore = 3;
          break;
        }
      }
    }

    return {
      isSystematic: isSystematic,
      type: matchedType,
      debuggingQuality: qualityScore,
      evidence: isSystematic || matchedType === 'trial_error' ? 'Matched regex pattern' : 'none',
      reasoning: `Rule-based: ${matchedType} pattern detected`,
      parseError: false,
      fallback: true
    };
  }

  /**
   * Calculate score from AI assessments
   */
  calculateScoreFromAI(aiAnalysis) {
    const { systematicDebugging, allAnalyses } = aiAnalysis;

    if (allAnalyses.length === 0) {
      return 0;
    }

    // Base score from count (0-4 points)
    let countScore = 0;
    if (systematicDebugging.count >= 5) {
      countScore = 4;
    } else if (systematicDebugging.count >= 3) {
      countScore = 3;
    } else if (systematicDebugging.count >= 1) {
      countScore = 2;
    }

    // Quality score (0-4 points)
    const qualityScore = (systematicDebugging.quality / 10) * 4;

    // Diversity bonus (0-2 points) - reward different types of systematic debugging
    const typeCount = Object.keys(systematicDebugging.breakdown).length;
    const diversityScore = Math.min(2, typeCount * 0.5);

    // Total score (0-10)
    const totalScore = Math.min(10, countScore + qualityScore + diversityScore);

    return Math.round(totalScore * 10) / 10;
  }

  determineVerdict(score) {
    if (score >= 8) return 'systematic';
    if (score >= 4) return 'trial_and_error';
    return 'helpless';
  }

  /**
   * Calculate confidence based on AI analysis quality
   */
  calculateConfidenceFromAI(aiAnalysis) {
    const { systematicDebugging, successRate } = aiAnalysis;

    let confidence = 0.3; // baseline

    // Higher confidence with more systematic debugging found
    if (systematicDebugging.count >= 5) {
      confidence += 0.3;
    } else if (systematicDebugging.count >= 3) {
      confidence += 0.2;
    } else if (systematicDebugging.count >= 1) {
      confidence += 0.1;
    }

    // Higher confidence with diverse types
    const typeCount = Object.keys(systematicDebugging.breakdown).length;
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

module.exports = DebuggingReasoningAnalyzer;
