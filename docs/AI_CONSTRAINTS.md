# AI_CONSTRAINTS

## Provider

Use an OpenAI-compatible chat/completions or responses provider.

Environment variables:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_TIMEOUT_MS`

The model name must be configurable and must not be hard-coded in business logic.

## AI Tasks

### Optimize Message

Endpoint:

```http
POST /api/ai/optimize-message
```

Purpose: convert a sender's original family message into a clearer, warmer, less escalating version without changing intent.

Required JSON fields:

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

Endpoint:

```http
POST /api/ai/analyze-message
```

Purpose: help the receiver understand possible emotion, need, and response direction. It must not judge either side.

Required JSON fields:

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

Endpoint:

```http
POST /api/ai/optimize-reply
```

Purpose: improve a receiver's reply so it is sincere, respectful, non-preachy, non-sarcastic, and less likely to cause harm.

Required JSON fields:

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

All prompts must instruct the model to:

- Preserve the user's real meaning.
- Avoid adding facts not present in the input.
- Avoid forced apology or forced forgiveness.
- Avoid judging who is right.
- Express boundaries respectfully when boundaries are present.
- Use plain Chinese suitable for family communication.
- Return valid JSON only.

## Risk Handling

High-risk categories:

- Self-harm or suicide intent.
- Domestic violence or credible threats.
- Abuse toward minors or elders.
- Coercive control, stalking, or severe intimidation.
- Severe humiliation or emotional blackmail.

For high-risk content:

- Do not produce ordinary warm rewriting as the primary result.
- Return `riskLevel: "high"`.
- Encourage immediate real-world support from trusted people or emergency services when appropriate.
- Keep wording calm and direct.
- Do not promise confidentiality, diagnosis, or professional treatment.

## Failure Handling

If the model call fails:

- Return a stable backend error code such as `AI_PROVIDER_FAILED`.
- Do not send a half-parsed AI result.
- The mini program should let the user retry or send original content according to privacy settings.
