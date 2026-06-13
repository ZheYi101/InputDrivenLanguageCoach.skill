# Validation Rubric

Use this rubric when checking whether a generated lesson or correction pass is good enough.

## 1. Contract check

- The lesson respects the declared `track`
- The output keeps the six required sections
- The lesson stays grounded in the provided input

Fail if:

- it auto-switches tracks
- it becomes generic language advice
- it drops `Profile Delta + Review Candidates`

## 2. Scene quality

- `Scene Capsule` explains why the lines matter in this exact scene
- It captures intent and tone, not just content

Fail if:

- it reads like a flat summary
- the context would still fit many unrelated passages

## 3. Target selection quality

- Chunks or vocabulary are high leverage for the track
- Low-value fillers are excluded
- Each item includes meaning, value, and misuse risk

Fail if:

- the list is mostly dictionary glosses
- the items are too random or too numerous

## 4. Exercise quality

- `Comprehension Check` forces noticing
- `Error-Prone Rewrite` targets predictable learner errors
- `Contextual Output` keeps the learner inside the source scene or argument

Fail if:

- the exercises are generic translation drills
- the output task can be completed without using the targets

## 5. Feedback quality

- Corrections explain what changed and why
- Pattern-level errors are surfaced
- `Profile Delta` is concrete and non-judgmental

Fail if:

- feedback is only praise or only blunt correction
- profile notes are vague, inflated, or personality-based

## 6. Shareability check

- No personal file paths
- No user-specific platform assumptions in core instructions
- Another user could apply the skill with only their own text and metadata

Fail if:

- the skill depends on one person's archive layout
- examples are treated as mandatory defaults
