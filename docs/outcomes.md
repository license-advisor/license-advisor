# Outcome Taxonomy

This project alerts. It does not sentence.

Every finding produced by the deterministic engine must use exactly one of the outcomes below. The LLM may explain an outcome; it must not invent a new one.

## Outcomes

| Outcome | Meaning | User-facing tone |
|---|---|---|
| `clear` | No relevant obligation detected **under the current project assumptions**. | Calm. Restate assumptions. Do not say “approved” or “legal”. |
| `notice` | Obligations exist but are usually operationally manageable (e.g. attribution / NOTICE files). | Informative. Tell the user what to keep track of. |
| `red_flag` | Meaningful conditions appear incompatible with the stated shipping intent and should be reviewed before shipping. | Direct alert. Not a legal verdict. |
| `insufficient_context` | The engine cannot evaluate safely because required intent or architecture answers are missing. | Ask concrete follow-up questions. Do not guess. |
| `review_required` | License + architecture interaction cannot be resolved automatically with confidence. | Escalate to a human / qualified review. |
| `conflict` | A deterministic policy rule identifies an incompatibility with the project’s declared constraints. | Strongest automatic signal. Still not a court judgment. |

## Design rules

1. **Be non-sentencing without being vague.**  
   Prefer: `red_flag` under stated assumptions.  
   Avoid: “maybe risky” without a category.

2. **Prefer false caution over false comfort.**  
   A wrong `clear` is worse than an extra `red_flag`.

3. **Always echo assumptions** on `notice`, `red_flag`, `review_required`, and `conflict`.

4. **Never invent percentage safety scores** as the primary UX.  
   Numeric values are allowed only for technical detection confidence.

5. **`clear` is conditional.**  
   It means “clear under these assumptions,” not “safe forever.”

6. **No professor / lawyer voice.**  
   Alert, show evidence, state limits.

## Suggested CI defaults

```yaml
fail_on:
  - conflict

warn_on:
  - red_flag
  - review_required
```

Teams may tighten this later. The open-source default should stay conservative but not noisy.

## Mapping examples

### Paid closed-source SaaS + AGPL dependency + network access
→ `red_flag` (or `review_required` if modification / component boundary is unknown)

### Paid closed-source SaaS + MIT dependency
→ `clear` (under stated assumptions)

### Any commercial project + Apache-2.0 dependency
→ usually `notice` if NOTICE/attribution handling is in scope; otherwise `clear` with notice guidance depending on rule pack

### GPL dependency + internal-only, no distribution
→ typically not an automatic distribution `conflict`; explain assumptions; monitor if delivery model changes

### Unknown license expression
→ `review_required` or `insufficient_context` - never “probably MIT”

## Language bank (preferred)

Use:

- “Under your stated intent…”
- “This deserves attention before shipping…”
- “Red flag for review - not a legal determination…”
- “Assumptions used…”
- “Automated analysis is insufficient here…”

Avoid:

- “You are legally forbidden…”
- “This is approved…”
- “Safe to ship…”
- “As a lawyer / compliance officer…”
- “You should always…”
- “Replace this with package Y…”
