/**
 * DeepSeek prompt template for evaluating debugging reasoning quality
 */

const DEBUGGING_REASONING_PROMPT = `You are evaluating whether a developer's debugging prompt shows systematic thinking during an AI-assisted coding session.

PROMPT TO EVALUATE:
"{PROMPT_TEXT}"

SYSTEMATIC DEBUGGING INDICATORS (shows strong debugging skills):
- Forms hypotheses ("I think the issue is X because Y", "This error suggests...")
- Tests methodically ("First I'll check...", "Then I'll try...", "Step 1...")
- Narrows down problem space ("I've ruled out A", "Isolated the issue to...")
- Identifies root causes ("The underlying issue is...", "This is caused by...")
- Shows sequential reasoning (logical progression from observation to solution)
- Explains what was tried and what was learned

TRIAL-AND-ERROR INDICATORS (weak debugging, just guessing):
- Random attempts without reasoning ("Try this?", "What about that?")
- No hypothesis, just throwing solutions at the wall
- Repeating "still doesn't work" without learning from failures
- No explanation of why trying something

HELPLESS INDICATORS (no debugging ability):
- "Why doesn't this work?" with no investigation attempt
- Asking AI to fix without providing context or error details
- No attempt to understand the problem
- Just complaining about errors without analysis

SCORING GUIDE:
0-2: Helpless - no debugging strategy, just asking for fixes
3-4: Trial-and-error - random attempts, minimal reasoning
5-6: Some structure - basic hypothesis but weak methodology
7-8: Systematic - clear hypotheses, methodical testing
9-10: Excellent - root cause analysis, learns from attempts, narrows problem space

Respond ONLY with valid JSON (no other text):
{
  "isSystematic": boolean,
  "debuggingQuality": number between 0-10,
  "type": "hypothesis" | "testing" | "root_cause" | "narrowing" | "trial_error" | "helpless",
  "evidence": "quote the specific phrase that shows debugging approach",
  "reasoning": "brief explanation of why this shows systematic/trial-error/helpless debugging"
}`;

/**
 * Build the prompt for a specific debugging prompt text
 */
function buildPrompt(promptText) {
  return DEBUGGING_REASONING_PROMPT.replace('{PROMPT_TEXT}', promptText.replace(/"/g, '\\"'));
}

/**
 * Parse DeepSeek response into structured object
 */
function parseResponse(responseText) {
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultResponse('Could not find JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (typeof parsed.isSystematic !== 'boolean') {
      parsed.isSystematic = false;
    }

    if (!['hypothesis', 'testing', 'root_cause', 'narrowing', 'trial_error', 'helpless'].includes(parsed.type)) {
      parsed.type = 'helpless';
    }

    if (typeof parsed.debuggingQuality !== 'number' || parsed.debuggingQuality < 0 || parsed.debuggingQuality > 10) {
      parsed.debuggingQuality = 0;
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
    isSystematic: false,
    type: 'helpless',
    debuggingQuality: 0,
    evidence: 'none',
    reasoning: `Parse failed: ${reason}`,
    parseError: true
  };
}

module.exports = {
  DEBUGGING_REASONING_PROMPT,
  buildPrompt,
  parseResponse,
  getDefaultResponse
};
