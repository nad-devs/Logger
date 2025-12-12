/**
 * Debugging Session Tracker
 *
 * Detects and tracks debugging sessions (error → fix cycles)
 *
 * Detection strategies:
 * 1. Keyword analysis: "error", "bug", "fix", "broken", "doesn't work"
 * 2. Stack trace detection in prompts
 * 3. Error message patterns
 * 4. Resolution tracking (independent vs AI-assisted)
 */

class DebuggingTracker {
  constructor(db) {
    this.db = db;
    this.activeDebuggingSessions = new Map(); // conversationId -> session
  }

  /**
   * Analyze prompt to detect debugging activity
   * @param {number} promptId
   * @param {string} promptContent
   * @param {string} conversationId
   * @returns {boolean} Whether this is a debugging prompt
   */
  analyzePromptForDebugging(promptId, promptContent, conversationId) {
    const isDebugging = this._detectDebuggingIntent(promptContent);

    if (isDebugging) {
      const errorInfo = this._extractErrorInfo(promptContent);

      // Update prompt table to mark as debugging
      this.db.prepare(`
        UPDATE prompts SET is_debugging = 1 WHERE id = ?
      `).run(promptId);

      // Track or update debugging session
      if (!this.activeDebuggingSessions.has(conversationId)) {
        // Start new debugging session
        this.activeDebuggingSessions.set(conversationId, {
          startPromptId: promptId,
          startTime: Date.now(),
          errorInfo,
          resolutionPrompts: [promptId]
        });
      } else {
        // Add to existing session
        const session = this.activeDebuggingSessions.get(conversationId);
        session.resolutionPrompts.push(promptId);
      }
    }

    return isDebugging;
  }

  /**
   * Check if edit resolves active debugging session
   * @param {string} conversationId
   * @param {boolean} editSuccess - Whether the edit was successful
   */
  checkResolution(conversationId, editSuccess = true) {
    if (this.activeDebuggingSessions.has(conversationId) && editSuccess) {
      const session = this.activeDebuggingSessions.get(conversationId);
      const resolutionTime = Date.now() - session.startTime;

      // Independent resolution = only 1-2 prompts (didn't ask AI repeatedly)
      const independentResolution = session.resolutionPrompts.length <= 2;

      try {
        this.db.prepare(`
          INSERT INTO debugging_sessions
          (conversation_id, error_type, error_message, stack_trace,
           resolution_prompts, resolution_time_ms, independent_resolution, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          conversationId,
          session.errorInfo.type,
          session.errorInfo.message,
          session.errorInfo.stackTrace,
          JSON.stringify(session.resolutionPrompts),
          resolutionTime,
          independentResolution ? 1 : 0
        );

        // Clear the active session
        this.activeDebuggingSessions.delete(conversationId);
      } catch (err) {
        console.error('Failed to log debugging session:', err.message);
      }
    }
  }

  /**
   * Manually end a debugging session (for timeout or user-initiated)
   * @param {string} conversationId
   */
  endSession(conversationId) {
    if (this.activeDebuggingSessions.has(conversationId)) {
      this.checkResolution(conversationId, false);
      this.activeDebuggingSessions.delete(conversationId);
    }
  }

  /**
   * Get active debugging session for a conversation
   * @param {string} conversationId
   * @returns {object|null}
   */
  getActiveSession(conversationId) {
    return this.activeDebuggingSessions.get(conversationId) || null;
  }

  /**
   * Detect if prompt is about debugging/fixing errors
   * @private
   */
  _detectDebuggingIntent(prompt) {
    const debugKeywords = [
      /\berror\b/i,
      /\bbug\b/i,
      /\bfix\b/i,
      /\bbroken\b/i,
      /doesn't work/i,
      /not working/i,
      /\bfailed\b/i,
      /\bcrash/i,
      /\bexception\b/i,
      /\bundefined\b/i,
      /null reference/i,
      /syntax error/i,
      /\bfailing\b/i,
      /\bissue\b/i,
      /\bproblem\b/i,
      /\bwrong\b/i,
      /unexpected/i
    ];

    return debugKeywords.some(regex => regex.test(prompt));
  }

  /**
   * Extract error information from prompt
   * @private
   */
  _extractErrorInfo(prompt) {
    // Extract stack trace
    const stackTraceMatch = prompt.match(/at .+:\d+:\d+/g);

    // Extract error type
    const errorTypeMatch = prompt.match(/(TypeError|ReferenceError|SyntaxError|Error|Exception):/);

    // Extract error message (first 200 chars or until newline)
    let errorMessage = prompt;
    const firstNewline = prompt.indexOf('\n');
    if (firstNewline > 0 && firstNewline < 200) {
      errorMessage = prompt.substring(0, firstNewline);
    } else {
      errorMessage = prompt.substring(0, 200);
    }

    return {
      type: errorTypeMatch ? errorTypeMatch[1] : 'unknown',
      message: errorMessage.trim(),
      stackTrace: stackTraceMatch ? stackTraceMatch.join('\n') : null
    };
  }

  /**
   * Get debugging statistics for a conversation
   * @param {string} conversationId
   * @returns {object}
   */
  getDebugStats(conversationId) {
    try {
      const sessions = this.db.prepare(`
        SELECT * FROM debugging_sessions WHERE conversation_id = ?
      `).all(conversationId);

      const independentCount = sessions.filter(s => s.independent_resolution === 1).length;
      const avgResolutionTime = sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.resolution_time_ms, 0) / sessions.length
        : 0;

      return {
        totalSessions: sessions.length,
        independentResolutions: independentCount,
        independenceRate: sessions.length > 0 ? independentCount / sessions.length : 0,
        avgResolutionTimeMs: Math.round(avgResolutionTime),
        sessions: sessions
      };
    } catch (err) {
      console.error('Failed to get debug stats:', err.message);
      return {
        totalSessions: 0,
        independentResolutions: 0,
        independenceRate: 0,
        avgResolutionTimeMs: 0,
        sessions: []
      };
    }
  }
}

module.exports = DebuggingTracker;
