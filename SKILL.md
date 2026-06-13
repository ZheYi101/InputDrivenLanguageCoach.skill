---
name: english-input-coach
description: |
  Use when the user already has English input materials as text, such as video transcripts,
  subtitles, or articles, and wants Codex to turn them into structured learning sessions.
  Best for Chinese-speaking learners who want lessons driven by their real input instead of
  generic textbook content. Supports two explicit tracks in v1: live_chat for conversational
  transcripts and article_reading for continuous written text. Also use when the user wants
  corrections on their exercise answers from a prior lesson generated from the same input.
---

# English Input Coach

把学习者已经接触过的英文输入，变成一轮可执行、可纠错、可沉淀的学习闭环。

This skill converts English input that the learner already consumed into a teachable loop:

1. Anchor the scene and intention of the input
2. Highlight high-value chunks or vocabulary
3. Force retrieval and noticing
4. Push contextual output
5. Update a lightweight profile delta from the learner's errors

## Always Load The Right Reference

Use this table before doing anything substantial.

| Situation | Must load |
| --- | --- |
| Validate minimum fields or decide whether the input is in scope | `references/input-contract.md` |
| Build a lesson for a transcript, stream, subtitle, or casual spoken excerpt | `references/track-live-chat.md` |
| Build a lesson for an article, essay, blog post, or continuous written passage | `references/track-article-reading.md` |
| Correct learner answers and update the learning snapshot | `references/profile-schema.md` |
| Audit whether the lesson structure is grounded in the intended pedagogy | `references/pedagogy.md` |
| Check whether a generated lesson or correction pass is good enough | `references/validation-rubric.md` |

## When to use

Use this skill when:

- The user provides English text from a transcript, subtitle file, or article
- The user wants to learn from their own input instead of generic material
- The user wants contextualized vocabulary/chunk practice
- The user sends answers to exercises and wants correction plus next-step guidance

Do not use this skill for:

- Subtitle downloading, OCR, or ASR
- Beginner language instruction from zero
- General proofreading unrelated to an input passage
- Technical explainers as a separate track in v1

## Required input contract

Before teaching, validate the minimum contract from [references/input-contract.md](references/input-contract.md).

The caller should provide:

- `input_type`: `transcript` or `article`
- `track`: `live_chat` or `article_reading`
- `title`
- `text`

Optional fields:

- `learner_language` default `zh-CN`
- `source_url`
- `creator_or_channel`
- `watched_or_read` default `true`

If `track` is missing, ask the user to choose. Do not auto-classify in v1.

## Workflow

### Mode A: Build a lesson from input

1. Validate the input contract.
2. Read [references/pedagogy.md](references/pedagogy.md) only if you need to justify or audit the method.
3. Read the track guide:
   - `live_chat` -> [references/track-live-chat.md](references/track-live-chat.md)
   - `article_reading` -> [references/track-article-reading.md](references/track-article-reading.md)
4. Produce the lesson in this fixed order:
   - `Scene Capsule`
   - `High-Value Chunks / Vocab`
   - `Comprehension Check`
   - `Error-Prone Rewrite`
   - `Contextual Output`
   - `Profile Delta + Review Candidates`
5. Keep explanations concise and actionable. The goal is a session the learner can actually do.

### Mode B: Review learner answers from a prior lesson

Use this mode when the user replies with answers to `Comprehension Check`, `Error-Prone Rewrite`, or `Contextual Output`.

1. Re-anchor the targets from the prior lesson.
2. Correct the learner's answers directly and concretely.
3. Prioritize pattern-level errors over one-off typos.
4. Explain what changed and why, especially:
   - subject choice
   - adjective vs. verb structure
   - fixed chunk integrity
   - logical connectors
   - register mismatch
5. End with an updated `Profile Delta + Review Candidates`.

## Output contract

Always preserve the six-section structure. Use the field expectations from [references/profile-schema.md](references/profile-schema.md).

### Scene Capsule

- 4 to 6 sentences
- Chinese-led explanation
- Must explain what is happening in the source so the later language points have context

### High-Value Chunks / Vocab

- `live_chat`: prefer reusable chunks over isolated words
- `article_reading`: combine key terms and reusable written expressions
- For each item include:
  - source meaning in context
  - why it is worth learning
  - a common misuse or pitfall

### Comprehension Check

- At least 3 short items
- Prefer short answer, matching, or scenario judgment
- Do not pad with low-value multiple choice

### Error-Prone Rewrite

- At least 3 items
- Must target likely production failures for the track

### Contextual Output

- `live_chat`: 4 to 6 spoken-style sentences in the original scene
- `article_reading`: one 80 to 150 word summary, paraphrase, or stance rewrite
- Require reuse of at least 2 to 3 target items

### Profile Delta + Review Candidates

Output only the current learning delta, not a full permanent profile.

## Track-specific references

- Read [references/track-live-chat.md](references/track-live-chat.md) for VTuber, stream, and casual transcript lessons.
- Read [references/track-article-reading.md](references/track-article-reading.md) for continuous text, arguments, and article-based lessons.
- Read [references/validation-rubric.md](references/validation-rubric.md) when evaluating whether a generated lesson or correction pass is good enough.

## Important constraints

- Do not claim the method is scientifically proven to be optimal.
- Use research only to justify the structure, not to overstate certainty.
- Do not drift into generic textbook instruction. Stay grounded in the provided input.
- Do not return huge inventories of vocabulary. Select for reuse and leverage.
- Do not turn `Profile Delta` into a personality judgment. It is a learning-state snapshot.
