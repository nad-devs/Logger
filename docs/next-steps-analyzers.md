# Next Steps: Complete Remaining Analyzers

## Current Status

### ✅ Completed (AI-Powered)
1. **Critical Thinking Analyzer** - Detects questioning, tradeoff thinking, edge cases
2. **Debugging Reasoning Analyzer** - Evaluates systematic vs trial-and-error debugging
3. **Mistake Catcher Analyzer** - Identifies when candidate catches AI mistakes

### ⏳ Remaining (Still Regex-Based)
4. **Context Analyzer** - Detects building knowledge vs random mentions
5. **Modification Analyzer** - Analyzes how candidate modifies AI code

---

## Architecture Pattern (Established)

All completed analyzers follow this consistent pattern:

### 1. Prompt Template File
**Location:** `/evaluator/prompts/<analyzer-name>-prompt.js`

**Structure:**
```javascript
const PROMPT = `You are evaluating [what]...

PROMPT TO EVALUATE:
"{PROMPT_TEXT}"

[INDICATORS OF GOOD]
[INDICATORS OF BAD]

SCORING GUIDE:
0-2: [description]
3-4: [description]
...

Respond ONLY with valid JSON:
{
  "fieldName": boolean/string/number,
  ...
}`;

function buildPrompt(promptText) { ... }
function parseResponse(responseText) { ... }
function getDefaultResponse(reason) { ... }
```

### 2. Analyzer Class
**Location:** `/evaluator/understanding/<analyzer-name>-analyzer.js`

**Key Methods:**
- `analyze(conversationId)` - Main entry point
- `analyzeAllPromptsWithAI(prompts)` - Loops through all prompts
- `analyzePromptWithAI(promptText)` - Calls DeepSeek for single prompt
- `ruleBasedAnalysis(text)` - Fallback when AI unavailable
- `calculateScoreFromAI(aiAnalysis)` - Aggregates AI scores
- `calculateConfidenceFromAI(aiAnalysis)` - Confidence based on AI success rate

**Return Object:**
```javascript
{
  score: 7.2,
  verdict: 'category',
  confidence: 0.85,
  [mainMetric]: {
    count: 4,
    examples: [...],
    quality: 8.0,
    breakdown: { type1: 2, type2: 2 },
    aiReasoning: [...]
  },
  analysisMethod: 'ai' | 'fallback',
  aiSuccessRate: 0.92
}
```

---

## Task 1: Context Analyzer (AI-Powered)

### Current Implementation
**File:** `/evaluator/understanding/context-analyzer.js`

**What it detects (via regex):**
- Context references ("the code we wrote earlier")
- Knowledge progression ("so if we do X, then Y")
- Architecture awareness ("this affects the database layer")

### AI-Powered Upgrade

#### Step 1: Create Prompt Template
**File:** `/evaluator/prompts/context-analyzer-prompt.js`

**What AI should evaluate:**
```
CONTEXT-BUILDING INDICATORS (shows understanding):
- References previous code/decisions ("as we discussed earlier")
- Builds on prior knowledge ("so that means we need to...")
- Shows architectural awareness ("this impacts the auth layer")
- Connects concepts across session
- Demonstrates learning trajectory

NOT CONTEXT-BUILDING (disconnected):
- Every prompt starts fresh (no memory)
- Doesn't reference previous code
- Asks same questions repeatedly
- No connection between prompts
```

**JSON Output:**
```javascript
{
  "hasContextAwareness": boolean,
  "contextType": "reference" | "knowledge_building" | "architecture" | "learning" | "none",
  "qualityScore": 0-10,
  "evidence": "quote showing context awareness",
  "reasoning": "why this shows/doesn't show context building"
}
```

#### Step 2: Refactor Analyzer
**File:** `/evaluator/understanding/context-analyzer.js`

**Changes needed:**
1. Import prompt template functions
2. Add `analyzeAllPromptsWithAI()` method
3. Add `analyzePromptWithAI()` method
4. Add `ruleBasedAnalysis()` fallback (use existing regex patterns)
5. Update `calculateScore()` to `calculateScoreFromAI()`
6. Update return object to match new format
7. Add `calculateConfidenceFromAI()` method

**Scoring Logic:**
- Count score (0-4 points): Number of context-aware prompts
- Quality score (0-4 points): Average AI quality rating
- Diversity bonus (0-2 points): Different types of context awareness

#### Step 3: Test
```bash
node test-understanding-analyzers.js <conversation_id>
```

Verify output shows:
- `analysisMethod: 'ai'`
- `contextAwareness.breakdown` with types
- `aiReasoning` with examples

---

## Task 2: Modification Analyzer (AI-Powered)

### Current Implementation
**File:** `/evaluator/understanding/modification-analyzer.js`

**What it detects (via edit analysis):**
- Modification rate (how often user changes AI code)
- Blind acceptance rate (accepts AI code as-is)
- Modification quality (are changes improvements?)

### AI-Powered Upgrade

**⚠️ Important Difference:**
This analyzer needs **AI RESPONSES** from the database, not just user prompts. Currently we don't capture AI responses.

#### Option A: Skip for now (Recommended)
Wait until we implement AI response capture before upgrading this analyzer.

#### Option B: Hybrid approach
Keep existing edit-based analysis, but add AI evaluation of user's modification patterns:

**What AI evaluates:**
```
Analyze this sequence of edits:
1. User asked: "Add authentication"
2. AI suggested: [code]
3. User modified: [diff]

Did the user:
- Blindly accept? (copied as-is)
- Intelligently modify? (improved logic, added validation)
- Break something? (introduced bugs)
- Show understanding? (caught AI mistakes)
```

**JSON Output:**
```javascript
{
  "modificationType": "blind_accept" | "intelligent_modify" | "break" | "improve",
  "qualityScore": 0-10,
  "evidence": "what changed and why it matters",
  "reasoning": "does this show code understanding?"
}
```

---

## Recommended Approach

### Phase 1: Complete Context Analyzer (Today)
1. Create `/evaluator/prompts/context-analyzer-prompt.js`
2. Refactor `/evaluator/understanding/context-analyzer.js`
3. Test on existing data
4. Commit

**Time estimate:** 1-2 hours

### Phase 2: Handle Modification Analyzer (Later)
Two options:

**Option A (Recommended):** Keep current regex-based version until we capture AI responses
- Pro: Faster to complete
- Con: One analyzer still regex-based

**Option B:** Upgrade to hybrid AI evaluation
- Pro: All analyzers AI-powered
- Con: Limited without AI response data

### Phase 3: Add to Background Service
Update `background-analyzer.js` to include new analyzers:

```javascript
await this.runAnalyzer('ContextAnalyzer', ContextAnalyzer, conversationId);
await this.runAnalyzer('ModificationAnalyzer', ModificationAnalyzer, conversationId);
```

---

## Implementation Checklist

### Context Analyzer
- [ ] Create prompt template file
- [ ] Add `analyzeAllPromptsWithAI()` method
- [ ] Add `analyzePromptWithAI()` method
- [ ] Add `ruleBasedAnalysis()` fallback
- [ ] Update scoring to `calculateScoreFromAI()`
- [ ] Update return object format
- [ ] Add to background service
- [ ] Test on real conversation
- [ ] Update `test-understanding-analyzers.js` to handle new format
- [ ] Commit changes

### Modification Analyzer (Choose One)
**Option A: Keep Regex**
- [ ] Add to background service as-is
- [ ] Document limitation in README

**Option B: Hybrid AI**
- [ ] Create prompt template for modification quality
- [ ] Add AI evaluation method
- [ ] Keep existing edit-based metrics
- [ ] Combine AI + edit analysis
- [ ] Test and commit

---

## Testing After Completion

### Quick Test
```bash
# Start background analyzer
node background-analyzer.js &

# Code for a few minutes (create new conversation)

# Check results
node view-results.js
```

### Expected Output
```
ANALYZED CONVERSATIONS
======================================================================
1. <conversation_id>
   Prompts: 12 | Analyzers: 5 | Avg Score: 6.8/10
   Last analyzed: 2025-12-18T...

ANALYSIS RESULTS
======================================================================
1. CRITICALTHINKING
   Score: 6.2/10
   Verdict: uncertain

2. DEBUGGINGREASONING
   Score: 4.9/10
   Verdict: trial_and_error

3. MISTAKECATCHER
   Score: 7.0/10
   Verdict: somewhat_critical

4. CONTEXTANALYZER
   Score: 6.5/10
   Verdict: somewhat_aware

5. MODIFICATIONANALYZER
   Score: 7.0/10
   Verdict: selective_user
```

---

## Key Files Reference

### To Create/Modify:
1. `/evaluator/prompts/context-analyzer-prompt.js` (NEW)
2. `/evaluator/understanding/context-analyzer.js` (REFACTOR)
3. `/evaluator/prompts/modification-analyzer-prompt.js` (NEW - if doing Option B)
4. `/evaluator/understanding/modification-analyzer.js` (REFACTOR)
5. `/background-analyzer.js` (ADD new analyzers)
6. `/test-understanding-analyzers.js` (UPDATE for new formats)

### Existing Pattern Examples:
- `/evaluator/prompts/critical-thinking-prompt.js`
- `/evaluator/prompts/debugging-reasoning-prompt.js`
- `/evaluator/prompts/mistake-catcher-prompt.js`
- `/evaluator/understanding/critical-thinking-analyzer.js`
- `/evaluator/understanding/debugging-reasoning-analyzer.js`
- `/evaluator/understanding/mistake-catcher-analyzer.js`

---

## After All Analyzers Complete

### Final Steps:
1. Update `docs/activity.md` with completion summary
2. Test on **real coding session** (not meta-conversation about the tool)
3. Document any findings/improvements needed
4. Consider: Do we need AI response capture for better analysis?
5. Plan: Build post-session understanding verification (Phase 2)

---

## Questions to Consider

1. **AI Response Capture:** Should we implement this before finishing Modification Analyzer?
   - Would enable: Better modification analysis, understanding verification
   - Complexity: Need to hook into Cursor/Claude Code response stream

2. **Scoring Calibration:** After real coding session, do scores make sense?
   - Too harsh? Too generous?
   - Need to adjust scoring thresholds?

3. **Performance:** Is 5-second polling optimal?
   - Too frequent? (CPU usage)
   - Too slow? (delayed results)

4. **Database Migration:** Should we add indexes for performance?
   ```sql
   CREATE INDEX idx_analysis_conv ON analysis_results(conversation_id);
   CREATE INDEX idx_prompts_conv ON prompts(conversation_id);
   ```

---

## Success Criteria

✅ All 5 analyzers AI-powered (or documented reason for exception)
✅ Background service runs all analyzers automatically
✅ Results viewable via `view-results.js`
✅ Zero impact on user's coding performance
✅ Tested on real coding session
✅ Documentation updated

---

**Next immediate action:** Create Context Analyzer prompt template and start refactoring.
