// Prompt Quality Analyzer
// Evaluates prompts and assigns quality scores

const VAGUE_WORDS = ['this', 'that', 'it', 'something', 'stuff', 'thing', 'things', 'please', 'fix', 'help', 'better', 'good', 'bad'];
const TECHNICAL_TERMS = [
  // Programming concepts
  'function', 'method', 'class', 'component', 'module', 'interface', 'type', 'variable',
  'async', 'await', 'promise', 'callback', 'refactor', 'optimize', 'debug',

  // Languages/Frameworks
  'javascript', 'typescript', 'react', 'node', 'python', 'java', 'css', 'html',
  'vue', 'angular', 'express', 'django', 'flask',

  // Concepts
  'api', 'endpoint', 'database', 'query', 'schema', 'migration', 'authentication',
  'authorization', 'validation', 'sanitization', 'error handling', 'try-catch',
  'regex', 'json', 'xml', 'http', 'rest', 'graphql',

  // Design patterns
  'singleton', 'factory', 'observer', 'middleware', 'hook', 'prop', 'state',
  'redux', 'context', 'provider', 'reducer',

  // Styling
  'margin', 'padding', 'flex', 'grid', 'align', 'justify', 'baseline', 'pixel',
  'responsive', 'mobile', 'desktop', 'viewport', 'breakpoint',

  // Development
  'test', 'unit test', 'integration test', 'mock', 'stub', 'lint', 'format',
  'build', 'compile', 'transpile', 'bundle', 'webpack', 'vite',

  // Version control
  'commit', 'branch', 'merge', 'rebase', 'pull request', 'git'
];

const MEASUREMENT_PATTERNS = [
  /\d+\s*(px|em|rem|%|vh|vw|pt)/gi,  // CSS measurements
  /\d+\s*(ms|s|seconds?|minutes?)/gi, // Time measurements
  /line\s+\d+/gi,                     // Line numbers
  /version\s+\d+/gi,                  // Version numbers
  /\d+\s*pixels?/gi                   // Pixel measurements
];

const FILE_PATH_PATTERNS = [
  /[\w-]+\.[\w]+/g,                   // file.ext
  /[\w-]+\/[\w-/]+\.[\w]+/g,          // path/to/file.ext
  /src\/[\w-/]+/g,                    // src/...
  /components?\/[\w-/]+/gi,            // components/...
  /api\/[\w-/]+/gi,                   // api/...
  /utils?\/[\w-/]+/gi,                // utils/...
  /pages?\/[\w-/]+/gi                 // pages/...
];

/**
 * Analyze a prompt and return quality scores
 */
function analyzePrompt(promptText) {
  const text = promptText.toLowerCase();
  const words = promptText.split(/\s+/);
  const wordCount = words.filter(w => w.trim().length > 0).length;

  // Calculate individual scores
  const specificityScore = calculateSpecificityScore(promptText, text, words);
  const clarityScore = calculateClarityScore(promptText, text, words);
  const technicalDepthScore = calculateTechnicalDepthScore(promptText, text);
  const actionabilityScore = calculateActionabilityScore(promptText, text, words);

  // Overall score is weighted average
  const overall_score = Math.round(
    (specificityScore * 0.3) +
    (clarityScore * 0.2) +
    (technicalDepthScore * 0.3) +
    (actionabilityScore * 0.2)
  );

  // Extract metadata
  const technicalTerms = extractTechnicalTerms(text);
  const fileReferences = extractFileReferences(promptText);
  const hasNumbers = /\d/.test(promptText);
  const category = categorizePrompt(text);
  const suggestions = generateSuggestions(promptText, {
    specificityScore,
    clarityScore,
    technicalDepthScore,
    actionabilityScore
  });

  return {
    specificity_score: specificityScore,
    clarity_score: clarityScore,
    technical_depth_score: technicalDepthScore,
    actionability_score: actionabilityScore,
    overall_score: overall_score,
    category: category,
    technical_terms: technicalTerms,
    file_references: fileReferences,
    word_count: wordCount,
    has_numbers: hasNumbers,
    has_file_refs: fileReferences.length > 0,
    improvement_suggestions: suggestions
  };
}

/**
 * Specificity Score: How specific and detailed is the prompt?
 */
function calculateSpecificityScore(original, lower, words) {
  let score = 50; // Start at middle

  // Penalty for vague words
  const vagueCount = VAGUE_WORDS.filter(vw => {
    const regex = new RegExp(`\\b${vw}\\b`, 'i');
    return regex.test(lower);
  }).length;
  score -= vagueCount * 5;

  // Bonus for specific measurements
  let measurementCount = 0;
  MEASUREMENT_PATTERNS.forEach(pattern => {
    const matches = original.match(pattern);
    if (matches) measurementCount += matches.length;
  });
  score += Math.min(measurementCount * 10, 30);

  // Bonus for file/path references
  const fileRefs = extractFileReferences(original);
  score += Math.min(fileRefs.length * 15, 30);

  // Bonus for longer prompts (more detail)
  if (words.length > 20) score += 10;
  if (words.length > 40) score += 10;

  // Penalty for very short prompts
  if (words.length < 5) score -= 20;
  if (words.length < 3) score -= 30;

  return Math.max(0, Math.min(100, score));
}

/**
 * Clarity Score: Is the prompt clear and well-structured?
 */
function calculateClarityScore(original, lower, words) {
  let score = 50;

  // Bonus for structured format
  if (/^\d+\./.test(original)) score += 15; // Numbered list
  if (/^[-*]/.test(original)) score += 15;  // Bullet points
  if (original.includes('\n')) score += 10; // Multi-line

  // Bonus for proper grammar
  if (original.match(/^[A-Z]/)) score += 5; // Starts with capital
  if (original.match(/[.!?]$/)) score += 5; // Ends with punctuation

  // Penalty for run-on sentences
  const sentences = original.split(/[.!?]+/).filter(s => s.trim());
  if (sentences.length === 1 && words.length > 30) score -= 10;

  // Bonus for clear action verbs at the start
  const actionVerbs = ['add', 'remove', 'update', 'fix', 'refactor', 'move', 'change', 'create', 'delete', 'modify', 'implement'];
  const firstWord = words[0]?.toLowerCase();
  if (actionVerbs.includes(firstWord)) score += 15;

  // Penalty for question marks (questions are often less clear commands)
  if (original.includes('?')) score -= 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Technical Depth Score: How technical and specific is the language?
 */
function calculateTechnicalDepthScore(original, lower) {
  let score = 30; // Start lower

  // Extract and count technical terms
  const technicalTerms = extractTechnicalTerms(lower);
  score += Math.min(technicalTerms.length * 8, 50);

  // Bonus for code-like syntax
  if (original.match(/[a-zA-Z]+\([^)]*\)/)) score += 10; // function calls
  if (original.match(/\{[\s\S]*\}/)) score += 5;          // objects
  if (original.match(/`[^`]+`/)) score += 10;             // code blocks

  // Bonus for specific patterns
  if (lower.includes('async') || lower.includes('await')) score += 5;
  if (lower.includes('error handling') || lower.includes('try-catch')) score += 5;
  if (lower.includes('test') || lower.includes('unit test')) score += 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Actionability Score: Can the AI immediately understand and act on this?
 */
function calculateActionabilityScore(original, lower, words) {
  let score = 50;

  // Bonus for clear imperative commands
  const imperativeVerbs = ['add', 'remove', 'update', 'create', 'delete', 'move', 'change', 'refactor', 'fix', 'implement', 'modify'];
  if (imperativeVerbs.some(v => lower.startsWith(v))) score += 20;

  // Penalty for questions or uncertainty
  if (original.includes('?')) score -= 15;
  if (lower.includes('maybe') || lower.includes('perhaps') || lower.includes('possibly')) score -= 10;
  if (lower.includes('could you') || lower.includes('can you') || lower.includes('please')) score -= 5;

  // Bonus for specific targets (files, functions, components)
  const fileRefs = extractFileReferences(original);
  if (fileRefs.length > 0) score += 15;

  // Bonus for context and constraints
  if (lower.includes('without') || lower.includes('except') || lower.includes('but not')) score += 10;
  if (lower.includes('because') || lower.includes('since') || lower.includes('to ensure')) score += 10;

  // Penalty for vague requests
  if (lower === 'fix this' || lower === 'help' || lower === 'fix it') score -= 40;

  return Math.max(0, Math.min(100, score));
}

/**
 * Extract technical terms from text
 */
function extractTechnicalTerms(lowerText) {
  const found = [];
  TECHNICAL_TERMS.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(lowerText)) {
      found.push(term);
    }
  });
  return [...new Set(found)]; // Remove duplicates
}

/**
 * Extract file references from text
 */
function extractFileReferences(text) {
  const found = [];
  FILE_PATH_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      found.push(...matches);
    }
  });
  return [...new Set(found)]; // Remove duplicates
}

/**
 * Categorize the prompt type
 */
function categorizePrompt(lowerText) {
  if (lowerText.includes('fix') || lowerText.includes('bug') || lowerText.includes('error') || lowerText.includes('issue')) {
    return 'bug_fix';
  }
  if (lowerText.includes('refactor') || lowerText.includes('clean') || lowerText.includes('improve') || lowerText.includes('optimize')) {
    return 'refactor';
  }
  if (lowerText.includes('add') || lowerText.includes('create') || lowerText.includes('implement') || lowerText.includes('new')) {
    return 'feature';
  }
  if (lowerText.includes('?') || lowerText.includes('how') || lowerText.includes('what') || lowerText.includes('why')) {
    return 'question';
  }
  if (lowerText.includes('test') || lowerText.includes('spec')) {
    return 'testing';
  }
  if (lowerText.includes('style') || lowerText.includes('css') || lowerText.includes('design') || lowerText.includes('ui')) {
    return 'styling';
  }
  return 'other';
}

/**
 * Generate improvement suggestions based on scores
 */
function generateSuggestions(original, scores) {
  const suggestions = [];

  if (scores.specificityScore < 50) {
    suggestions.push('Be more specific: mention exact files, functions, or line numbers');
  }
  if (scores.clarityScore < 50) {
    suggestions.push('Structure your prompt better: use numbered steps or bullet points');
  }
  if (scores.technicalDepthScore < 50) {
    suggestions.push('Use more technical terminology and be precise about what you want');
  }
  if (scores.actionabilityScore < 50) {
    suggestions.push('Make it more actionable: start with a clear command verb (add, remove, update, etc.)');
  }

  if (original.toLowerCase() === original) {
    suggestions.push('Use proper capitalization');
  }

  if (original.split(/\s+/).length < 5) {
    suggestions.push('Provide more context and detail');
  }

  const vaguePhrases = ['fix this', 'help', 'make it better', 'improve this'];
  if (vaguePhrases.some(phrase => original.toLowerCase().includes(phrase))) {
    suggestions.push('Avoid vague phrases - explain exactly what needs to change');
  }

  return suggestions.join('; ');
}

module.exports = {
  analyzePrompt
};
