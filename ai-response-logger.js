/**
 * AI Response Logger
 *
 * Captures AI responses from Cursor/Claude Code and stores them
 * with metadata for analysis.
 *
 * Challenge: Cursor/Claude Code don't expose response hooks directly.
 *
 * Solution Approaches (in priority order):
 * 1. Edit similarity detection (compare edits to recent prompts)
 * 2. Manual logging via command
 * 3. File watcher for AI-generated code insertions
 */

class AIResponseLogger {
  constructor(db) {
    this.db = db;
  }

  /**
   * Log an AI response
   * @param {Object} response
   * @param {string} response.conversationId
   * @param {number} response.promptId
   * @param {string} response.content
   * @param {string} response.modelName
   * @param {number} response.tokensUsed
   * @param {number} response.responseTimeMs
   * @returns {number|null} The inserted response ID
   */
  logResponse(response) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ai_responses
        (conversation_id, prompt_id, response_content, model_name,
         tokens_used, response_time_ms, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const result = stmt.run(
        response.conversationId,
        response.promptId,
        response.content,
        response.modelName || 'unknown',
        response.tokensUsed || null,
        response.responseTimeMs || null
      );

      return result.lastInsertRowid;
    } catch (err) {
      console.error('Failed to log AI response:', err.message);
      return null;
    }
  }

  /**
   * Detect AI-generated code by comparing edits to AI responses
   * @param {number} editId
   * @param {string} codeContent
   * @returns {Promise<Object>} { aiResponseId, modificationType, similarity }
   */
  async detectAICodeUsage(editId, codeContent) {
    try {
      // Get the conversation ID for this edit
      const edit = this.db.prepare(`
        SELECT conversation_id FROM edits WHERE id = ?
      `).get(editId);

      if (!edit) {
        return { modificationType: 'manual', similarity: 0 };
      }

      // Get recent AI responses for this conversation (within last 5 minutes)
      const recentResponses = this.db.prepare(`
        SELECT id, response_content
        FROM ai_responses
        WHERE conversation_id = ?
          AND datetime(timestamp) > datetime('now', '-5 minutes')
        ORDER BY timestamp DESC
        LIMIT 5
      `).all(edit.conversation_id);

      // If no AI responses, assume manual
      if (recentResponses.length === 0) {
        return { modificationType: 'manual', similarity: 0 };
      }

      // Find best matching AI response
      let bestMatch = {
        aiResponseId: null,
        similarity: 0,
        modificationType: 'manual'
      };

      for (const response of recentResponses) {
        const similarity = this._calculateSimilarity(
          codeContent,
          response.response_content
        );

        if (similarity > bestMatch.similarity) {
          bestMatch.similarity = similarity;
          bestMatch.aiResponseId = response.id;
        }
      }

      // Classify modification type based on similarity
      if (bestMatch.similarity > 0.95) {
        bestMatch.modificationType = 'accepted'; // Used as-is
      } else if (bestMatch.similarity > 0.6) {
        bestMatch.modificationType = 'modified'; // Changed AI suggestion
      } else if (bestMatch.similarity > 0.3) {
        bestMatch.modificationType = 'rejected'; // Mostly different
      } else {
        bestMatch.modificationType = 'manual'; // Completely manual
        bestMatch.aiResponseId = null;
      }

      return bestMatch;
    } catch (err) {
      console.error('Failed to detect AI code usage:', err.message);
      return { modificationType: 'manual', similarity: 0 };
    }
  }

  /**
   * Calculate similarity between two code strings using token-based approach
   * @private
   */
  _calculateSimilarity(str1, str2) {
    // Normalize strings (remove extra whitespace, lowercase)
    const normalize = (str) => {
      return str
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    };

    const norm1 = normalize(str1);
    const norm2 = normalize(str2);

    // Exact match
    if (norm1 === norm2) {
      return 1.0;
    }

    // Token-based Jaccard similarity
    const tokens1 = new Set(norm1.split(/\s+/));
    const tokens2 = new Set(norm2.split(/\s+/));

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    if (union.size === 0) {
      return 0;
    }

    return intersection.size / union.size;
  }

  /**
   * Get AI responses for a conversation
   * @param {string} conversationId
   * @returns {Array}
   */
  getResponses(conversationId) {
    try {
      return this.db.prepare(`
        SELECT * FROM ai_responses
        WHERE conversation_id = ?
        ORDER BY timestamp ASC
      `).all(conversationId);
    } catch (err) {
      console.error('Failed to get AI responses:', err.message);
      return [];
    }
  }

  /**
   * Get response by ID
   * @param {number} responseId
   * @returns {Object|null}
   */
  getResponse(responseId) {
    try {
      return this.db.prepare(`
        SELECT * FROM ai_responses WHERE id = ?
      `).get(responseId);
    } catch (err) {
      console.error('Failed to get AI response:', err.message);
      return null;
    }
  }

  /**
   * Get statistics about AI response usage
   * @param {string} conversationId
   * @returns {Object}
   */
  getUsageStats(conversationId) {
    try {
      const responses = this.getResponses(conversationId);

      const totalTokens = responses.reduce((sum, r) => sum + (r.tokens_used || 0), 0);
      const avgResponseTime = responses.length > 0
        ? responses.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / responses.length
        : 0;

      return {
        totalResponses: responses.length,
        totalTokens,
        avgTokensPerResponse: responses.length > 0 ? totalTokens / responses.length : 0,
        avgResponseTimeMs: Math.round(avgResponseTime),
        models: [...new Set(responses.map(r => r.model_name))]
      };
    } catch (err) {
      console.error('Failed to get usage stats:', err.message);
      return {
        totalResponses: 0,
        totalTokens: 0,
        avgTokensPerResponse: 0,
        avgResponseTimeMs: 0,
        models: []
      };
    }
  }
}

module.exports = AIResponseLogger;
