/**
 * Ollama Client for Semantic Analysis
 * Uses DeepSeek-R1:1.5b for advanced prompt understanding
 */

const http = require('http');

const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const MODEL = 'deepseek-r1:1.5b';

class OllamaClient {
  constructor() {
    this.baseUrl = `http://${OLLAMA_HOST}:${OLLAMA_PORT}`;
  }

  /**
   * Check if Ollama is running and model is available
   */
  async checkAvailability() {
    try {
      const models = await this.listModels();
      const hasModel = models.some(m => m.name.includes('deepseek-r1'));

      return {
        available: true,
        hasModel: hasModel,
        models: models.map(m => m.name)
      };
    } catch (error) {
      return {
        available: false,
        hasModel: false,
        error: error.message
      };
    }
  }

  /**
   * List available models
   */
  async listModels() {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: '/api/tags',
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.models || []);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Ollama connection timeout'));
      });
      req.end();
    });
  }

  /**
   * Generate completion using Ollama
   */
  async generate(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      const requestBody = JSON.stringify({
        model: options.model || MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.3,
          top_p: options.top_p || 0.9,
          num_predict: options.max_tokens || 500
        }
      });

      const req = http.request({
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.response || '');
          } catch (e) {
            reject(new Error(`Failed to parse Ollama response: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Ollama generation timeout'));
      });

      req.write(requestBody);
      req.end();
    });
  }

  /**
   * Analyze prompt intent and classification
   */
  async analyzePromptIntent(promptText) {
    const prompt = `Analyze this AI coding prompt and classify it. Be concise.

Prompt: "${promptText}"

Respond with ONLY a JSON object (no other text):
{
  "intent": "question|implementation|bugfix|refactor|testing|exploration",
  "understanding_level": "confused|learning|competent|expert",
  "specificity": "vague|moderate|specific",
  "shows_context_awareness": true|false,
  "architectural_thinking": true|false,
  "key_concepts": ["concept1", "concept2"]
}`;

    try {
      const response = await this.generate(prompt, { temperature: 0.2, max_tokens: 300 });

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      return JSON.parse(jsonStr);
    } catch (error) {
      // Fallback to basic analysis if Ollama fails
      return {
        intent: 'unknown',
        understanding_level: 'unknown',
        specificity: 'unknown',
        shows_context_awareness: false,
        architectural_thinking: false,
        key_concepts: [],
        error: error.message
      };
    }
  }

  /**
   * Analyze code edit quality and intent
   */
  async analyzeEditIntent(oldCode, newCode, context = '') {
    if (!oldCode && !newCode) {
      return { type: 'unknown', quality: 'unknown' };
    }

    const prompt = `Analyze this code change. Be concise.

Context: ${context || 'N/A'}

OLD CODE:
${oldCode || '(empty)'}

NEW CODE:
${newCode || '(empty)'}

Respond with ONLY a JSON object:
{
  "change_type": "addition|deletion|modification|refactor",
  "is_meaningful": true|false,
  "is_reversal": true|false,
  "quality": "poor|acceptable|good|excellent",
  "reason": "brief explanation"
}`;

    try {
      const response = await this.generate(prompt, { temperature: 0.2, max_tokens: 200 });

      let jsonStr = response.trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      return JSON.parse(jsonStr);
    } catch (error) {
      return {
        change_type: 'unknown',
        is_meaningful: false,
        is_reversal: false,
        quality: 'unknown',
        reason: error.message
      };
    }
  }

  /**
   * Compare two prompts to detect repetition or iteration
   */
  async comparePrompts(prompt1, prompt2) {
    const prompt = `Compare these two AI coding prompts. Be concise.

Prompt 1: "${prompt1}"
Prompt 2: "${prompt2}"

Respond with ONLY a JSON object:
{
  "is_repetitive": true|false,
  "is_refinement": true|false,
  "similarity_score": 0-100,
  "shows_learning": true|false
}`;

    try {
      const response = await this.generate(prompt, { temperature: 0.2, max_tokens: 150 });

      let jsonStr = response.trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      return JSON.parse(jsonStr);
    } catch (error) {
      return {
        is_repetitive: false,
        is_refinement: false,
        similarity_score: 0,
        shows_learning: false,
        error: error.message
      };
    }
  }
}

module.exports = new OllamaClient();
