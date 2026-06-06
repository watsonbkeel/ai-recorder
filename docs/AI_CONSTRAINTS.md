# AI_CONSTRAINTS

## Provider

Use an OpenAI-compatible provider configured only through local environment variables:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_TIMEOUT_MS`

Default provider values are `OPENAI_BASE_URL=https://token.bkeel.com/v1` and `OPENAI_MODEL=gpt-5.4-mini`. Do not commit real keys or provider secrets. `server/.env` is ignored by git.

## Backend-Built Context

All AI routes must build context on the backend:

- `optimize-message`: requires `familyId`; backend resolves receiver identity context from `visibility` and current family membership, then may use the current user's visible family history.
- `analyze-message`: requires `messageId`; backend verifies message visibility before loading context.
- `optimize-reply`: requires `messageId`; backend verifies message visibility before loading context.

Frontend must not provide arbitrary history, prior message text, family memory, or summaries as model context.

## Family Memory

`FamilyMemory` supports `family`, `member`, and `pair` scopes.

Rules:

- Memory is scoped to one `familyId`.
- Memory is never shared across families or projects.
- Memory never reuses old class-log data.
- Memory may summarize communication preferences, sensitive topics, avoid phrases, and effective phrases.
- Memory must not diagnose, label personality, judge character, or create fixed conclusions about a family member.
- `useFamilyMemory: false` means the backend must not query or inject `FamilyMemory`.
- Message/reply deletion or hiding marks memories stale or triggers recomputation.

## Privacy Rules

- Hidden original text must not enter AI context.
- Hidden original audio or transcript must not enter AI context.
- Current MVP does not generate transcripts from original audio; AI message optimization may use only the text original content or user-written voice summary supplied in the request.
- AI context may include optimized text, AI summaries, visible replies, identity metadata, and active family memory that the current user may access.
- Identity metadata may be used for称呼、语气、边界表达, not stereotypes.

## Output Fields

### Optimize Message

```json
{
  "optimizedText": "string",
  "emotionTags": ["string"],
  "coreNeed": "string",
  "communicationAdvice": "string",
  "riskLevel": "low|medium|high",
  "attackWarning": "string|null"
}
```

### Analyze Message

```json
{
  "possibleEmotions": ["string"],
  "realNeeds": ["string"],
  "whatToAvoid": ["string"],
  "suggestedResponse": "string",
  "riskLevel": "low|medium|high"
}
```

### Optimize Reply

```json
{
  "optimizedText": "string",
  "emotionTags": ["string"],
  "communicationAdvice": "string",
  "riskLevel": "low|medium|high",
  "attackWarning": "string|null"
}
```

## Prompt Rules

Prompts must instruct the model to:

- Preserve real intent and stated facts.
- Avoid forced apology, forced forgiveness, or invented affection.
- Avoid judging who is right.
- Make boundaries clearer and less escalating.
- Use warm, plain Chinese suitable for family communication.
- Avoid gender, age, rank, and role stereotypes.
- Return valid JSON only.

## High-Risk Handling

High-risk content includes self-harm, credible threats, domestic violence, abuse toward minors or elders, coercive control, stalking, severe humiliation, and emotional blackmail.

For high-risk content:

- Return `riskLevel: "high"`.
- Prioritize safety guidance over ordinary warm rewriting.
- Encourage real-world support where appropriate.
- Do not promise confidentiality, diagnose, or provide professional treatment.
