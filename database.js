const Database = require('better-sqlite3');
const path = require('path');

// Create/open database file
let db;
try {
  db = new Database(path.join(__dirname, 'cursor-interactions.db'));
} catch (err) {
  console.error('Failed to open database:', err.message);
  throw err;
}

// Initialize database schema (create tables if they don't exist)
function initDatabase() {
  try {
    // Table 1: Store user prompts
    db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        source TEXT DEFAULT 'unknown',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table 2: Store file edits
    db.exec(`
      CREATE TABLE IF NOT EXISTS edits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        old_string TEXT,
        new_string TEXT,
        source TEXT DEFAULT 'unknown',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table 3: Store prompt quality analysis
    db.exec(`
      CREATE TABLE IF NOT EXISTS prompt_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt_id INTEGER NOT NULL,
        specificity_score INTEGER DEFAULT 0,
        clarity_score INTEGER DEFAULT 0,
        technical_depth_score INTEGER DEFAULT 0,
        actionability_score INTEGER DEFAULT 0,
        overall_score INTEGER DEFAULT 0,
        category TEXT,
        technical_terms TEXT,
        file_references TEXT,
        word_count INTEGER,
        has_numbers BOOLEAN,
        has_file_refs BOOLEAN,
        improvement_suggestions TEXT,
        analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prompt_id) REFERENCES prompts(id)
      );
    `);

    // Create indexes for faster queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversation ON prompts(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_edits_conversation ON edits(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_analysis_prompt ON prompt_analysis(prompt_id);
      CREATE INDEX IF NOT EXISTS idx_analysis_score ON prompt_analysis(overall_score);
    `);
  } catch (err) {
    console.error('Failed to initialize database schema:', err.message);
    throw err;
  }
}

// Log a user prompt
function logPrompt(conversationId, promptText, source = 'unknown') {
  try {
    const stmt = db.prepare(`
      INSERT INTO prompts (conversation_id, prompt_text, source)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(conversationId, promptText, source);
    return result.lastInsertRowid;
  } catch (err) {
    console.error('Failed to log prompt:', err.message);
    return null;
  }
}

// Log a file edit
function logEdit(conversationId, filePath, oldString, newString, source = 'unknown') {
  try {
    const stmt = db.prepare(`
      INSERT INTO edits (conversation_id, file_path, old_string, new_string, source)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(conversationId, filePath, oldString, newString, source);
    return result.lastInsertRowid;
  } catch (err) {
    console.error('Failed to log edit:', err.message);
    return null;
  }
}

// Get a complete interaction (prompt + all its edits)
function getInteraction(conversationId) {
  try {
    // Get the prompt
    const promptStmt = db.prepare(`
      SELECT * FROM prompts WHERE conversation_id = ?
    `);
    const prompt = promptStmt.get(conversationId);

    if (!prompt) {
      return null;
    }

    // Get all edits for this conversation
    const editsStmt = db.prepare(`
      SELECT * FROM edits WHERE conversation_id = ? ORDER BY timestamp
    `);
    const edits = editsStmt.all(conversationId);

    return {
      ...prompt,
      edits
    };
  } catch (err) {
    console.error('Failed to get interaction:', err.message);
    return null;
  }
}

// Get all interactions (prompts with their edits)
function getAllInteractions() {
  try {
    const promptsStmt = db.prepare(`
      SELECT * FROM prompts ORDER BY timestamp DESC
    `);
    const prompts = promptsStmt.all();

    // For each prompt, get its edits
    return prompts.map(prompt => {
      const editsStmt = db.prepare(`
        SELECT * FROM edits WHERE conversation_id = ? ORDER BY timestamp
      `);
      const edits = editsStmt.all(prompt.conversation_id);

      return {
        ...prompt,
        edits
      };
    });
  } catch (err) {
    console.error('Failed to get all interactions:', err.message);
    return [];
  }
}

// Initialize database on module load
initDatabase();

// Log prompt analysis
function logAnalysis(promptId, analysis) {
  try {
    const stmt = db.prepare(`
      INSERT INTO prompt_analysis (
        prompt_id, specificity_score, clarity_score, technical_depth_score,
        actionability_score, overall_score, category, technical_terms,
        file_references, word_count, has_numbers, has_file_refs,
        improvement_suggestions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      promptId,
      analysis.specificity_score,
      analysis.clarity_score,
      analysis.technical_depth_score,
      analysis.actionability_score,
      analysis.overall_score,
      analysis.category,
      JSON.stringify(analysis.technical_terms),
      JSON.stringify(analysis.file_references),
      analysis.word_count,
      analysis.has_numbers ? 1 : 0,
      analysis.has_file_refs ? 1 : 0,
      analysis.improvement_suggestions
    );
    return result.lastInsertRowid;
  } catch (err) {
    console.error('Failed to log analysis:', err.message);
    return null;
  }
}

// Get analysis for a prompt
function getAnalysis(promptId) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM prompt_analysis WHERE prompt_id = ?
    `);
    const analysis = stmt.get(promptId);
    if (analysis) {
      analysis.technical_terms = JSON.parse(analysis.technical_terms || '[]');
      analysis.file_references = JSON.parse(analysis.file_references || '[]');
    }
    return analysis;
  } catch (err) {
    console.error('Failed to get analysis:', err.message);
    return null;
  }
}

// Export functions
module.exports = {
  logPrompt,
  logEdit,
  getInteraction,
  getAllInteractions,
  logAnalysis,
  getAnalysis,
  db // Export db instance for advanced queries
};
