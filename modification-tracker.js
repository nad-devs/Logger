/**
 * Code Modification Tracker
 *
 * Tracks how developers modify AI-suggested code
 * This is critical for Understanding Verification Analyzer
 *
 * Compares AI suggestions to final developer code to determine:
 * - Blind acceptance (used as-is)
 * - Intelligent modification (understood and improved)
 * - Rejection (completely different approach)
 */

class ModificationTracker {
  constructor(db, aiResponseLogger) {
    this.db = db;
    this.aiResponseLogger = aiResponseLogger;
  }

  /**
   * Track code modification after an edit
   * @param {string} conversationId
   * @param {number} editId
   * @param {string} finalCode
   */
  async trackModification(conversationId, editId, finalCode) {
    // Get AI usage info (similarity to recent AI responses)
    const aiUsage = await this.aiResponseLogger.detectAICodeUsage(editId, finalCode);

    if (aiUsage.aiResponseId) {
      // Found a matching AI response
      const originalSuggestion = this.db.prepare(`
        SELECT response_content FROM ai_responses WHERE id = ?
      `).get(aiUsage.aiResponseId);

      if (!originalSuggestion) return;

      const linesChanged = this._countLineChanges(
        originalSuggestion.response_content,
        finalCode
      );

      try {
        this.db.prepare(`
          INSERT INTO code_modifications
          (conversation_id, ai_response_id, original_suggestion,
           final_code, modification_type, lines_changed, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          conversationId,
          aiUsage.aiResponseId,
          originalSuggestion.response_content,
          finalCode,
          aiUsage.modificationType,
          linesChanged
        );
      } catch (err) {
        console.error('Failed to track modification:', err.message);
      }
    }
  }

  /**
   * Get modification statistics for a conversation
   * @param {string} conversationId
   * @returns {object}
   */
  getModificationStats(conversationId) {
    try {
      const modifications = this.db.prepare(`
        SELECT * FROM code_modifications WHERE conversation_id = ?
      `).all(conversationId);

      const accepted = modifications.filter(m => m.modification_type === 'accepted').length;
      const modified = modifications.filter(m => m.modification_type === 'modified').length;
      const rejected = modifications.filter(m => m.modification_type === 'rejected').length;

      const total = modifications.length;
      const acceptanceRatio = total > 0 ? accepted / total : 0;
      const modificationRatio = total > 0 ? modified / total : 0;

      return {
        totalModifications: total,
        accepted,
        modified,
        rejected,
        acceptanceRatio,
        modificationRatio,
        avgLinesChanged: total > 0
          ? modifications.reduce((sum, m) => sum + (m.lines_changed || 0), 0) / total
          : 0,
        modifications
      };
    } catch (err) {
      console.error('Failed to get modification stats:', err.message);
      return {
        totalModifications: 0,
        accepted: 0,
        modified: 0,
        rejected: 0,
        acceptanceRatio: 0,
        modificationRatio: 0,
        avgLinesChanged: 0,
        modifications: []
      };
    }
  }

  /**
   * Count line changes between two code blocks
   * @private
   */
  _countLineChanges(original, modified) {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');

    let changes = 0;
    const maxLen = Math.max(origLines.length, modLines.length);

    for (let i = 0; i < maxLen; i++) {
      const origLine = origLines[i] || '';
      const modLine = modLines[i] || '';

      // Normalize whitespace for comparison
      if (origLine.trim() !== modLine.trim()) {
        changes++;
      }
    }

    return changes;
  }

  /**
   * Analyze modification quality (helper for analyzers)
   * @param {string} conversationId
   * @returns {object}
   */
  analyzeModificationQuality(conversationId) {
    const stats = this.getModificationStats(conversationId);

    // Quality assessment based on modification patterns
    let qualityScore = 5.0;

    // High acceptance = lower score (blind acceptance)
    if (stats.acceptanceRatio > 0.8) {
      qualityScore -= 2.0;
    } else if (stats.acceptanceRatio > 0.5) {
      qualityScore -= 1.0;
    }

    // High modification = higher score (active engagement)
    if (stats.modificationRatio > 0.6) {
      qualityScore += 2.0;
    } else if (stats.modificationRatio > 0.3) {
      qualityScore += 1.0;
    }

    // Moderate line changes = sweet spot (not trivial, not complete rewrite)
    const avgChanges = stats.avgLinesChanged;
    if (avgChanges >= 2 && avgChanges <= 10) {
      qualityScore += 1.0;
    }

    qualityScore = Math.max(0, Math.min(10, qualityScore));

    return {
      qualityScore,
      ...stats
    };
  }
}

module.exports = ModificationTracker;
