# Pedagogy Notes

This file exists to justify the skill structure. It is not a script for long theory explanations.

## Design principle 1: Force noticing, not just exposure

Why it matters:

- Input alone is not enough for stable uptake.
- The learner should notice form-meaning links and the gap between what they understood and what they can produce.

How it changes the skill:

- Every lesson must include `Comprehension Check`.
- Every lesson must include `Error-Prone Rewrite`.
- Explanations should point to exact contrasts, not only give meaning.

Supporting references:

- Richard Schmidt's noticing hypothesis overview: [Wikipedia](https://en.wikipedia.org/wiki/Noticing_hypothesis)
- Richard Schmidt, 1990, `The role of consciousness in second language learning`

## Design principle 2: Output reveals the gap

Why it matters:

- Learners often understand more than they can produce.
- Asking for contextual output exposes broken chunks, weak collocations, and unstable sentence frames.

How it changes the skill:

- Every lesson must include `Contextual Output`.
- Correction should target error patterns, not only isolated wrong words.
- Follow-up turns should update `Profile Delta` from learner output.

Supporting references:

- Comprehensible output overview: [Wikipedia](https://en.wikipedia.org/wiki/Comprehensible_output)
- Merrill Swain's output hypothesis line of work

## Design principle 3: Retrieval beats passive review

Why it matters:

- Recalling information strengthens retention more reliably than only rereading.
- In practice, the learner should be asked to retrieve before and after explanation.

How it changes the skill:

- Lesson order is fixed:
  - brief comprehension check
  - explanation of targets
  - rewrite
  - contextual output
- Do not collapse the lesson into summary plus definitions.

Supporting references:

- Dunlosky et al. 2013: [SAGE abstract](https://doi.org/10.1177/1529100612453266)
- Karpicke and Blunt 2011: [Science DOI](https://doi.org/10.1126/science.1199327)

Interpretation note:

- These sources support retrieval-based lesson structure in general learning.
- They do not prove this exact skill template is uniquely optimal for language learning.

## Design principle 4: Preserve spacing hooks even without an SRS

Why it matters:

- Repeated review over time supports retention better than massed review.
- v1 does not implement scheduling, but it should leave review handles.

How it changes the skill:

- Every lesson ends with `review_candidates`.
- Review items should tell the learner what to rehearse next, not just list vocabulary.

Supporting references:

- Dunlosky et al. 2013: [SAGE abstract](https://doi.org/10.1177/1529100612453266)
- Cepeda et al. 2006: [DOI](https://doi.org/10.1037/0033-2909.132.3.354)

## Design principle 5: Live chat lessons should teach chunks, not loose words

Why it matters:

- Conversational fluency heavily relies on formulaic sequences.
- Breaking useful spoken chunks into separate dictionary entries often destroys their reuse value.

How it changes the skill:

- `live_chat` extracts should prioritize reusable multi-word chunks.
- Isolated word lists are a fallback, not the default.
- Corrections should preserve chunk integrity when the learner tries to reuse them.

Supporting references:

- Formulaic language overview: [Wikipedia](https://en.wikipedia.org/wiki/Formulaic_language)
- Wood 2006 is cited there as a review source on formulaic sequences in L2 speech

## Evidence boundary

Use these references to justify the structure of the skill.

Do not claim:

- that the template is scientifically proven to be best
- that all learners need the same number of items
- that a single lesson can diagnose stable proficiency

Treat the template as a research-informed workflow plus practical heuristics.
