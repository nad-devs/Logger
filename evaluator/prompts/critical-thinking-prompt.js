/**
 * DeepSeek prompt template for evaluating critical thinking in developer prompts
 */

const CRITICAL_THINKING_PROMPT = `You are evaluating whether a developer's prompt shows critical thinking during an AI-assisted coding session.

PROMPT TO EVALUATE:
"{PROMPT_TEXT}"

CRITICAL THINKING INDICATORS (shows understanding):
- Questioning AI's approach or suggesting alternatives ("why not use X instead?")
- Asking about tradeoffs (performance vs readability, security vs convenience)
- Considering edge cases or failure scenarios ("what if the user does X?")
- Showing awareness of architectural implications ("how will this scale?")
- Demonstrating security consciousness ("is this vulnerable to X?")
- Catching potential bugs or issues in AI suggestions
- Building on previous context thoughtfully

NOT CRITICAL THINKING (surface-level):
- Simple "how do I" questions without context (learning, not analyzing)
- Asking AI to do something without questioning the approach
- Copy-paste requests without understanding
- Surface-level "why" without depth ("why?" alone is not enough)
- Asking for explanations of basic concepts (learning mode)

SCORING GUIDE:
0-2: No critical thinking, just requests or basic questions
3-4: Minimal critical thinking, some awareness but shallow
5-6: Moderate critical thinking, shows some understanding
7-8: Good critical thinking, demonstrates solid understanding
9-10: Excellent critical thinking, deep understanding and foresight

Respond ONLY with valid JSON (no other text):
{
  "isCriticalThinking": boolean,
  "type": "tradeoff" | "security" | "edge_case" | "architecture" | "questioning_ai" | "learning" | "none",
  "qualityScore": number between 0-10,
  "evidence": "quote the specific phrase that shows critical thinking, or 'none' if not applicable",
  "reasoning": "brief explanation of why this does or doesn't show understanding"
}`;

/**
 * Build the prompt for a specific user prompt text
 */
function buildPrompt(promptText) {
  return CRITICAL_THINKING_PROMPT.replace('{PROMPT_TEXT}', promptText.replace(/"/g, '\\"'));
}

/**
 * Parse DeepSeek response into structured object
 * Handles common parsing issues with LLM JSON output
 */
function parseResponse(responseText) {
  try {
    // Try to extract JSON from response (sometimes LLM adds extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultResponse('Could not find JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (typeof parsed.isCriticalThinking !== 'boolean') {
      parsed.isCriticalThinking = false;
    }

    if (!['tradeoff', 'security', 'edge_case', 'architecture', 'questioning_ai', 'learning', 'none'].includes(parsed.type)) {
      parsed.type = 'none';
    }

    if (typeof parsed.qualityScore !== 'number' || parsed.qualityScore < 0 || parsed.qualityScore > 10) {
      parsed.qualityScore = 0;
    }

    if (typeof parsed.evidence !== 'string') {
      parsed.evidence = 'none';
    }

    if (typeof parsed.reasoning !== 'string') {
      parsed.reasoning = 'No reasoning provided';
    }

    return parsed;
  } catch (error) {
    return getDefaultResponse(`JSON parse error: ${error.message}`);
  }
}

/**
 * Default response when parsing fails
 */
function getDefaultResponse(reason) {
  return {
    isCriticalThinking: false,
    type: 'none',
    qualityScore: 0,
    evidence: 'none',
    reasoning: `Parse failed: ${reason}`,
    parseError: true
  };
}

module.exports = {
  CRITICAL_THINKING_PROMPT,
  buildPrompt,
  parseResponse,
  getDefaultResponse
};
