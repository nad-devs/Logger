/**
 * DeepSeek prompt template for evaluating mistake-catching ability
 */

const MISTAKE_CATCHER_PROMPT = `You are evaluating whether a developer catches AI mistakes or blindly accepts AI suggestions.

PROMPT TO EVALUATE:
"{PROMPT_TEXT}"

MISTAKE-CATCHING INDICATORS (shows critical thinking):
- Questioning AI's approach ("Wait, this won't handle X")
- Identifying bugs or security issues ("This has a SQL injection vulnerability")
- Catching logic errors ("But this doesn't account for edge case Y")
- Suggesting corrections ("Shouldn't we validate input first?")
- Preventing potential issues ("What if the user does X?")
- Security consciousness ("Is this secure?", "Could this leak data?")

NOT MISTAKE-CATCHING (accepts blindly):
- Asking AI to implement without reviewing
- No questioning of approach
- No mention of potential issues
- Just requesting features without analysis

SEVERITY LEVELS:
- high: Security vulnerabilities, data corruption, crashes
- medium: Logic bugs, incorrect behavior, edge cases
- low: Code quality issues, minor improvements

SCORING GUIDE:
0-2: Blind acceptance - no questioning or validation
3-4: Minimal awareness - basic questions but no deep analysis
5-6: Moderate awareness - catches some issues
7-8: Good awareness - catches bugs and security issues
9-10: Excellent awareness - proactive security and edge case thinking

Respond ONLY with valid JSON (no other text):
{
  "caughtMistake": boolean,
  "mistakeType": "security" | "bug" | "logic" | "edge_case" | "prevention" | "none",
  "severity": "high" | "medium" | "low" | "none",
  "qualityScore": number between 0-10,
  "evidence": "quote the specific phrase showing the caught mistake",
  "reasoning": "brief explanation of what mistake was caught or why this shows/doesn't show critical thinking"
}`;

/**
 * Build the prompt for a specific prompt text
 */
function buildPrompt(promptText) {
  return MISTAKE_CATCHER_PROMPT.replace('{PROMPT_TEXT}', promptText.replace(/"/g, '\\"'));
}

/**
 * Parse DeepSeek response into structured object
 */
function parseResponse(responseText) {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultResponse('Could not find JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (typeof parsed.caughtMistake !== 'boolean') {
      parsed.caughtMistake = false;
    }

    if (!['security', 'bug', 'logic', 'edge_case', 'prevention', 'none'].includes(parsed.mistakeType)) {
      parsed.mistakeType = 'none';
    }

    if (!['high', 'medium', 'low', 'none'].includes(parsed.severity)) {
      parsed.severity = 'none';
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
    caughtMistake: false,
    mistakeType: 'none',
    severity: 'none',
    qualityScore: 0,
    evidence: 'none',
    reasoning: `Parse failed: ${reason}`,
    parseError: true
  };
}

module.exports = {
  MISTAKE_CATCHER_PROMPT,
  buildPrompt,
  parseResponse,
  getDefaultResponse
};
