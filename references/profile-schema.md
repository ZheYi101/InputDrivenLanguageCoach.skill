# Profile Delta Schema

This schema captures what changed in the current learning pass. It is intentionally lightweight.

## Required fields

- `comprehension_strengths`
  - 1 to 3 short bullets about what the learner clearly handled
- `output_fragilities`
  - 1 to 3 short bullets about recurring production problems
- `reusable_chunks`
  - 2 to 5 items worth reusing in later speaking or writing
- `next_focus`
  - 1 to 3 short action points for the next lesson
- `review_candidates`
  - 3 to 6 items with a suggested review action

## Example shape

```yaml
Profile Delta:
  comprehension_strengths:
    - Understands the speaker's teasing tone and audience-management intent
    - Can identify the broad meaning of target chunks in context
  output_fragilities:
    - Breaks fixed spoken chunks during sentence production
    - Chooses unstable subjects in adjective-based sentences
  reusable_chunks:
    - take some getting used to
    - get along
    - sort it out
  next_focus:
    - Practice whole-chunk reuse in spoken sentences
    - Stabilize `This X is Y` patterns before adding complexity
  review_candidates:
    - item: take some getting used to
      action: say 3 scene-based lines aloud
    - item: get along
      action: rewrite one conflict-management line
```

## Guardrails

- Keep it diagnostic, not judgmental.
- Prefer error patterns over isolated mistakes.
- Do not claim long-term mastery from one lesson.
- Do not infer personality traits or motivation.
