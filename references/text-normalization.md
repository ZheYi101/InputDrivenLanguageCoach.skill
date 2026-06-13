# Text Normalization

Use this reference when the input text is still in a raw or noisy form.

Typical cases:

- `.srt` subtitle files
- `.vtt` subtitle files
- `.ass` or `.ssa` subtitle files
- subtitle dumps copied with timestamps
- ASR-style transcript exports
- copied text with broken line wraps or repeated fragments

## Principle

For this skill, normalization is not optional polishing.
It is a required preprocessing step whenever the raw text still contains artifacts that would weaken chunk extraction, scene reading, or exercise quality.

The goal is not to rewrite the source into polished prose.
The goal is to turn it into lesson-ready text while preserving scene, tone, and meaning.

## Minimum cleaning steps

### For raw subtitles or transcript dumps

Always do these first:

- remove numeric subtitle indices
- remove timestamps
- merge broken lines that belong to the same utterance
- remove obvious duplicate lines
- strip empty noise lines

### Additional rules for raw `.vtt`

Apply these when present:

- remove cue settings such as alignment or position metadata
- strip inline markup such as `<c>`, `<v>`, or embedded timestamp tags
- collapse rolling-caption overlap where each new cue repeats the previous leading text

The result should keep only the incremental spoken or narrated content, not the mechanical re-rendering behavior of the subtitle player.

### Additional rules for raw `.ass` or `.ssa`

Apply these when present:

- use only the dialogue/event text, not styling metadata
- strip override tags such as `{\\i1}` or positioning instructions
- collapse hard line breaks such as `\N` into readable sentence flow

This v1 workflow is text-focused.
It should preserve dialogue content, but it does not try to preserve subtitle styling semantics.

### For noisy transcript content

Apply these when clearly needed:

- remove obvious ASR garbage
- fix sentence breaks that are only formatting artifacts
- drop fragments that are too broken to teach from

Do not silently rewrite the speaker's wording into a different register.

## What to preserve

Keep:

- the speaker's tone
- interactional intent
- useful spoken disfluency when it matters for style
- enough surrounding context for the scene to still make sense

Do not over-clean into essay prose if the source is casual speech.

## Track choice after cleaning

Choose the track from the cleaned communicative shape, not the raw file extension.

- `live_chat`
  - streams
  - banter
  - interactive spoken reaction
- `article_reading`
  - documentary narration
  - historical explanation
  - essay-like continuous exposition

A subtitle file may still belong to `article_reading` if the cleaned output reads like continuous explanation rather than scene-by-scene chat.

## Segmentation after cleaning

After normalization:

1. find a coherent scene or passage
2. keep enough local context for interpretation
3. avoid oversized sessions
4. state clearly if you are using a cleaned excerpt instead of the full source

## Output expectation before teaching

Before lesson generation, the working text should:

- be readable as continuous text
- no longer contain timestamps, indices, or subtitle markup
- preserve who is speaking or narrating and what is happening
- be short enough for one useful lesson, or be sliced intentionally after cleaning

If these conditions are not met, clean first and only then teach.

## Repeatable workflow

When the user is repeatedly importing `.srt` or `.vtt` files, prefer the bundled scripts from `references/subtitle-ingestion.md` over one-off manual cleanup.

The same applies to basic `.ass/.ssa` text extraction when the subtitle content is already local and the styling itself is not the learning target.
