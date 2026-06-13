# Input Contract

This skill starts after the learner already has English text.

## Required fields

- `input_type`
  - Allowed: `transcript`, `article`
- `track`
  - Allowed: `live_chat`, `article_reading`
- `title`
- `text`

## Optional fields

- `learner_language`
  - Default: `zh-CN`
- `source_url`
- `creator_or_channel`
- `watched_or_read`
  - Default: `true`

## v1 rules

- Do not auto-detect the track.
- If `track` is missing, ask the user to choose.
- If `text` is too long for one useful session, select a representative slice and say so.
- Keep the lesson scoped to what the learner plausibly watched or read.

## Suggested normalized input shape

```json
{
  "input_type": "transcript",
  "track": "live_chat",
  "title": "Dual-stream opening segment",
  "text": "Full transcript or selected excerpt",
  "learner_language": "zh-CN",
  "source_url": "https://example.com/video",
  "creator_or_channel": "Example Channel",
  "watched_or_read": true
}
```

## Follow-up review shape

When the learner answers exercises, they do not need to resend a full JSON object. They only need enough context for the assistant to identify:

- which input passage the lesson came from
- which targets were assigned
- which answers belong to `Comprehension Check`, `Error-Prone Rewrite`, or `Contextual Output`

If prior context is missing, ask for the original lesson or restate the targets before correcting.
