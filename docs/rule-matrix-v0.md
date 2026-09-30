# Initial Rule Matrix (v0)

Deterministic starter rules for the npm MVP.  
Rules are data. The LLM does not create these outcomes.

Status key:

- `draft` - proposed, not yet fixture-tested
- `ready` - intended for first prototype

| rule_id | licenses | when (project context) | outcome | status | notes |
|---|---|---|---|---|---|
| `AGPL_NETWORK_001` | AGPL-3.0-only, AGPL-3.0-or-later | `network_access=true` AND `source_visibility=closed` | `red_flag` | ready | Classic closed SaaS vs AGPL tension |
| `AGPL_NETWORK_002` | AGPL-3.0-only, AGPL-3.0-or-later | `network_access=true` AND `modifies_dependencies=unknown` | `review_required` | draft | Need modification / boundary clarity |
| `GPL_DISTRIBUTION_001` | GPL-2.0-only, GPL-2.0-or-later, GPL-3.0-only, GPL-3.0-or-later | `customer_distribution` in `binaries`, `source`, `binaries_and_source` AND `source_visibility=closed` | `red_flag` | ready | Distribution + closed source |
| `GPL_INTERNAL_001` | GPL family | `delivery=internal_only` AND `customer_distribution=none` | `notice` | draft | No automatic distribution conflict; assumptions matter |
| `LGPL_LINKING_001` | LGPL family | `customer_distribution` != `none` AND `linking_model=unknown` | `insufficient_context` | draft | Linking/modification details may matter |
| `MPL_FILE_001` | MPL-2.0 | `modifies_dependencies=yes` AND `customer_distribution` != `none` | `notice` | draft | File-level copyleft obligations may apply |
| `APACHE_NOTICE_001` | Apache-2.0 | any commercial or distributed project | `notice` | ready | Attribution / NOTICE handling |
| `PERMISSIVE_001` | MIT, BSD-2-Clause, BSD-3-Clause, ISC | any | `clear` | ready | Still preserve license evidence |
| `SSPL_001` | SSPL-1.0 | `delivery=hosted_saas` OR `network_access=true` | `red_flag` | ready | Source-available; often incompatible with closed SaaS assumptions |
| `BUSL_001` | Business Source License family | `commercial=yes` | `red_flag` | draft | Check change date / additional use grant; often needs human reading |
| `UNKNOWN_LICENSE_001` | unresolved / no SPDX | any | `review_required` | ready | Never invent a license |
| `CONFLICTING_EVIDENCE_001` | declared != detected | any | `review_required` | ready | Preserve both evidence items |
| `MISSING_CONTEXT_001` | any copyleft / network / source-available family | required context fields missing | `insufficient_context` | ready | Ask follow-ups; do not guess |

## Non-goals for v0 rules

- No automatic package alternatives
- No “percent safe” scores
- No claims of legal approval
- No attempt to fully encode LGPL linking doctrine

## Authoring rules

1. Every rule has an id, license matchers, context conditions, outcome, short reason, and references.
2. If architecture details are material and unknown → `insufficient_context` or `review_required`.
3. Prefer `red_flag` over `conflict` unless the declared policy explicitly forbids the combination.
4. Keep reasons short, factual, and assumption-aware.
