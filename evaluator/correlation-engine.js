/**
 * Correlation Engine
 * Links prompts to their resulting edits and analyzes the relationship
 */

const db = require('../database');

class CorrelationEngine {
  /**
   * Get all interactions grouped by conversation
   */
  getConversationGroups() {
    const query = `
      SELECT DISTINCT conversation_id
      FROM prompts
      ORDER BY timestamp
    `;

    const conversations = db.db.prepare(query).all();

    return conversations.map(conv => {
      return this.getConversationData(conv.conversation_id);
    });
  }

  /**
   * Get complete data for a conversation
   */
  getConversationData(conversationId) {
    const prompts = db.db.prepare(`
      SELECT * FROM prompts
      WHERE conversation_id = ?
      ORDER BY timestamp
    `).all(conversationId);

    const edits = db.db.prepare(`
      SELECT * FROM edits
      WHERE conversation_id = ?
      ORDER BY timestamp
    `).all(conversationId);

    return {
      conversation_id: conversationId,
      prompts: prompts,
      edits: edits,
      source: prompts[0]?.source || 'unknown',
      started_at: prompts[0]?.timestamp,
      ended_at: edits[edits.length - 1]?.timestamp || prompts[prompts.length - 1]?.timestamp
    };
  }

  /**
   * Link prompts to their resulting edits
   */
  correlatePromptsToEdits() {
    const conversations = this.getConversationGroups();
    const correlations = [];

    conversations.forEach(conv => {
      conv.prompts.forEach((prompt, promptIndex) => {
        const correlation = {
          prompt_id: prompt.id,
          prompt_text: prompt.prompt_text,
          prompt_timestamp: prompt.timestamp,
          conversation_id: conv.conversation_id,
          source: conv.source,
          related_edits: [],
          stats: {
            total_edits: 0,
            files_changed: 0,
            lines_added: 0,
            lines_removed: 0,
            time_to_first_edit: null,
            edit_duration: null
          }
        };

        // Find edits that came after this prompt
        const promptTime = new Date(prompt.timestamp).getTime();
        const nextPromptTime = conv.prompts[promptIndex + 1]
          ? new Date(conv.prompts[promptIndex + 1].timestamp).getTime()
          : Infinity;

        conv.edits.forEach(edit => {
          const editTime = new Date(edit.timestamp).getTime();

          // Edit belongs to this prompt if it's between this prompt and the next
          if (editTime >= promptTime && editTime < nextPromptTime) {
            correlation.related_edits.push({
              edit_id: edit.id,
              file_path: edit.file_path,
              timestamp: edit.timestamp,
              old_string: edit.old_string,
              new_string: edit.new_string,
              time_after_prompt: editTime - promptTime
            });
          }
        });

        // Calculate stats
        if (correlation.related_edits.length > 0) {
          correlation.stats.total_edits = correlation.related_edits.length;
          correlation.stats.files_changed = new Set(
            correlation.related_edits.map(e => e.file_path)
          ).size;

          // Time to first edit
          correlation.stats.time_to_first_edit = correlation.related_edits[0].time_after_prompt;

          // Edit duration
          const lastEdit = correlation.related_edits[correlation.related_edits.length - 1];
          correlation.stats.edit_duration = lastEdit.time_after_prompt;

          // Count lines added/removed (rough estimate)
          correlation.related_edits.forEach(edit => {
            const oldLines = edit.old_string ? edit.old_string.split('\n').length : 0;
            const newLines = edit.new_string ? edit.new_string.split('\n').length : 0;

            if (newLines > oldLines) {
              correlation.stats.lines_added += (newLines - oldLines);
            } else {
              correlation.stats.lines_removed += (oldLines - newLines);
            }
          });
        }

        correlations.push(correlation);
      });
    });

    return correlations;
  }

  /**
   * Analyze prompt-to-edit effectiveness
   */
  analyzeEffectiveness(correlations) {
    const analysis = {
      total_prompts: correlations.length,
      prompts_with_edits: 0,
      prompts_without_edits: 0,
      avg_edits_per_prompt: 0,
      avg_files_per_prompt: 0,
      avg_time_to_first_edit: 0,
      effectiveness_score: 0
    };

    let totalEdits = 0;
    let totalFiles = 0;
    let totalTime = 0;
    let timeCount = 0;

    correlations.forEach(corr => {
      if (corr.related_edits.length > 0) {
        analysis.prompts_with_edits++;
        totalEdits += corr.stats.total_edits;
        totalFiles += corr.stats.files_changed;

        if (corr.stats.time_to_first_edit !== null) {
          totalTime += corr.stats.time_to_first_edit;
          timeCount++;
        }
      } else {
        analysis.prompts_without_edits++;
      }
    });

    if (analysis.prompts_with_edits > 0) {
      analysis.avg_edits_per_prompt = (totalEdits / analysis.prompts_with_edits).toFixed(2);
      analysis.avg_files_per_prompt = (totalFiles / analysis.prompts_with_edits).toFixed(2);
    }

    if (timeCount > 0) {
      analysis.avg_time_to_first_edit = Math.round(totalTime / timeCount);
    }

    // Effectiveness score: higher if most prompts lead to edits
    analysis.effectiveness_score = Math.round(
      (analysis.prompts_with_edits / analysis.total_prompts) * 100
    );

    return analysis;
  }

  /**
   * Detect iteration patterns (same file edited multiple times)
   */
  detectIterationPatterns(correlations) {
    const fileEditHistory = {};
    const iterationPatterns = [];

    correlations.forEach(corr => {
      corr.related_edits.forEach(edit => {
        if (!fileEditHistory[edit.file_path]) {
          fileEditHistory[edit.file_path] = [];
        }

        fileEditHistory[edit.file_path].push({
          prompt_id: corr.prompt_id,
          prompt_text: corr.prompt_text,
          timestamp: edit.timestamp,
          old_string: edit.old_string,
          new_string: edit.new_string
        });
      });
    });

    // Analyze each file's edit history
    Object.keys(fileEditHistory).forEach(filePath => {
      const history = fileEditHistory[filePath];

      if (history.length >= 2) {
        // Check for reversals (editing back to previous state)
        const reversals = this.detectReversals(history);

        if (history.length >= 3 || reversals.length > 0) {
          iterationPatterns.push({
            file_path: filePath,
            edit_count: history.length,
            unique_prompts: new Set(history.map(h => h.prompt_id)).size,
            has_reversals: reversals.length > 0,
            reversals: reversals,
            timeline: history.map(h => ({
              prompt_text: h.prompt_text.substring(0, 60),
              timestamp: h.timestamp
            }))
          });
        }
      }
    });

    // Sort by edit count (most iterated files first)
    iterationPatterns.sort((a, b) => b.edit_count - a.edit_count);

    return iterationPatterns;
  }

  /**
   * Detect code reversals (editing back to previous state)
   */
  detectReversals(editHistory) {
    const reversals = [];

    for (let i = 1; i < editHistory.length; i++) {
      const prev = editHistory[i - 1];
      const curr = editHistory[i];

      // Check if current edit reverts to an earlier state
      if (this.isSimilarCode(curr.new_string, prev.old_string)) {
        reversals.push({
          index: i,
          prompt_reverted_from: prev.prompt_text,
          prompt_reverted_to: curr.prompt_text,
          explanation: 'Code reverted to earlier state'
        });
      }
    }

    return reversals;
  }

  /**
   * Check if two code strings are similar (rough comparison)
   */
  isSimilarCode(str1, str2) {
    if (!str1 || !str2) return false;

    // Normalize whitespace and compare
    const normalized1 = str1.replace(/\s+/g, ' ').trim();
    const normalized2 = str2.replace(/\s+/g, ' ').trim();

    // If they're identical, it's a reversal
    if (normalized1 === normalized2) return true;

    // If they're very similar (>90% similarity), might be a reversal
    const similarity = this.calculateSimilarity(normalized1, normalized2);
    return similarity > 0.9;
  }

  /**
   * Calculate string similarity (Jaccard similarity)
   */
  calculateSimilarity(str1, str2) {
    const set1 = new Set(str1.split(/\s+/));
    const set2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }
}

module.exports = new CorrelationEngine();
