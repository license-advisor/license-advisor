# Technical reference

Deeper docs for contributors, power users, and anyone wiring License Advisor into scripts or agents.

For the friendly overview, start at the [README](../README.md).

---

## Supported ecosystems

| Ecosystem | Manifest | Notes |
|---|---|---|
| npm | `package-lock.json` v2/v3 | Preferred when present |
| pnpm | `pnpm-lock.yaml` | Common v6/v9 layouts |
| Yarn classic | `yarn.lock` v1 | Yarn Berry (v2+) not yet |
| PyPI | `requirements.txt` + `.venv`/`venv` | Best path for transitive deps + METADATA licenses |
| PyPI | `poetry.lock` / `uv.lock` | Graph from lock; prefer a venv for licenses |

Discovery order (no `--lockfile`): npm → pnpm → yarn → poetry → uv → requirements+venv.

Unsupported today: Yarn Berry, Go, Maven/Gradle, Cargo, HTML-only projects with no dependency manifest.

See also: [limitations.md](./limitations.md)

---

## Feature checklist

| Capability | Status |
|---|---|
| Project shipping-context schema | yes |
| npm / pnpm / Yarn classic graphs | yes |
| PyPI graphs | yes |
| SPDX-oriented license resolution + evidence | yes |
| Deterministic policy engine (v0) | yes |
| CLI + interactive wizard | yes |
| MCP server | yes |
| Human / JSON / Markdown scan output | yes |
| MIT license | yes |
| GitHub Action / Yarn Berry / Maven / Go | planned |

---

## How the engine fits together

```text
project-context.yaml     lockfiles / requirements+venv
        │                              │
        ▼                              ▼
 Shipping intent              Dependency graph
        │                     + license evidence
        └──────────────┬───────────────┘
                       ▼
              Deterministic rules
                       │
                       ▼
           Findings (clear / notice /
            red_flag / review_required / …)
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
         CLI                      MCP
```

Core principle: **user states intent → rules decide what is known → LLM only explains.**

---

## Project context

Intent lives in `project-context.yaml`:

```yaml
schema_version: "0.1.0"
project:
  name: my-saas
  delivery: hosted_saas
  commercial: yes
  audience: third_parties
  source_visibility: closed
  customer_distribution: none
  network_access: true
  modifies_dependencies: unknown
  linking_model: unknown
  dependency_scopes_in_scope:
    - production
policy:
  fail_on: [conflict]
  warn_on: [red_flag, review_required]
```

Examples:

- [`../examples/project-context.saas.yaml`](../examples/project-context.saas.yaml)
- [`../examples/project-context.internal.yaml`](../examples/project-context.internal.yaml)
- [`../examples/project-context.sdk.yaml`](../examples/project-context.sdk.yaml)

Schema: [`../schemas/project-context.schema.json`](../schemas/project-context.schema.json)

Wrong intent produces wrong alerts.

---

## Outcomes (compact)

| Outcome | Meaning |
|---|---|
| `clear` | No relevant obligation detected under current assumptions |
| `notice` | Manageable obligations (e.g. attribution) |
| `red_flag` | Meaningful tension with stated shipping intent |
| `insufficient_context` | Need clearer architecture / intent answers |
| `review_required` | Automated analysis is not enough |
| `conflict` | Deterministic incompatibility with declared constraints |

Details and tone rules: [outcomes.md](./outcomes.md)

---

## CLI reference

```bash
license-advisor <command>
# while developing this repo:
npm run dev -- <command>
```

### Setup & context

| Command | Description |
|---|---|
| *(no args)* / `interactive` | Guided terminal wizard |
| `init [--name <name>] [--force]` | Create `project-context.yaml` |
| `context show [--path <file>]` | Print validated shipping intent |
| `context validate [--path <file>]` | Schema validation only |
| `mcp` | Start the stdio MCP server |
| `outcomes` | Print outcome taxonomy |

### Dependencies

| Command | Description |
|---|---|
| `deps summary [--lockfile <file>]` | Graph stats |
| `deps list [--direct\|--transitive] [--json]` | List packages |
| `deps why <package>` | Show introduction path |

### Licenses

| Command | Description |
|---|---|
| `licenses summary` | Resolution stats |
| `licenses list [--status <status>]` | List resolutions |
| `licenses show <package>` | Evidence for one package |

### Scan

| Command | Description |
|---|---|
| `scan` | Evaluate rules → findings |
| `scan --json` | Machine-readable report |
| `scan --markdown` | Markdown report |
| `scan --draft` | Include draft rules |
| `scan --path <context> --lockfile <file>` | Explicit inputs |

Exit: `1` when a `fail_on` outcome is present (default `conflict`); otherwise `0`.

---

## MCP tools

| Tool | Purpose |
|---|---|
| `scan_project` | Full contextual scan |
| `explain_finding` | Evidence-backed explanation |
| `check_dependency` | One-package license + findings |
| `get_dependency_path` | Why a package is in the tree |
| `get_project_context` | Read shipping intent |
| `update_project_context` | Patch shipping intent |
| `list_outcomes` | Outcome taxonomy |

Config examples:

- [`../examples/mcp.cursor.json`](../examples/mcp.cursor.json) - after `npm link`
- [`../examples/mcp.cursor.from-checkout.json`](../examples/mcp.cursor.from-checkout.json) - relative checkout

Full agent guide: [mcp-setup.md](./mcp-setup.md)

---

## Rule pack (v0)

Rules are data: auditable and independent from LLM behavior.

Examples:

- `AGPL_NETWORK_001` - closed-source + network access
- `GPL_DISTRIBUTION_001` - closed-source + customer distribution
- `APACHE_NOTICE_001` - attribution / NOTICE awareness
- `SSPL_001` / `SSPL_NETWORK_001` - source-available service tension
- `UNKNOWN_LICENSE_001` / `CONFLICTING_EVIDENCE_001` - never invent certainty

Matrix: [rule-matrix-v0.md](./rule-matrix-v0.md)

Finding schema: [`../schemas/finding.schema.json`](../schemas/finding.schema.json)

---

## Repository map

```text
license-advisor/
├── assets/
├── docs/                   # this folder
├── examples/               # context + MCP examples
├── fixtures/               # npm / pnpm / yarn / pypi / saas-agpl
├── schemas/
├── src/
│   ├── cli.ts
│   ├── context.ts
│   ├── graph/              # npm, pnpm, yarn, PyPI
│   ├── licenses/
│   ├── policy/
│   └── mcp/
├── LICENSE                 # MIT
└── ai_native_license_advisor_strategy.md
```

---

## Development

```bash
npm install
npm test
npm run build
npm link
npm run dev -- outcomes
npm run mcp
```

```bash
npm test
npm run test:unit
npm run test:policy
npm run test:mcp
npm run test:selfchecks
```

Demo scans:

```bash
npm run dev -- scan \
  --path fixtures/saas-agpl/project-context.yaml \
  --lockfile fixtures/saas-agpl/package-lock.json

npm run dev -- scan \
  --path fixtures/pypi/project-context.yaml \
  --lockfile fixtures/pypi/requirements.txt
```

---

## Design principles

1. Alert, don’t sentence.
2. Intent is first-class. SaaS ≠ SDK ≠ internal tool.
3. Evidence over vibes.
4. Prefer false caution over false comfort.
5. LLM is a thin explanation layer - never the decision engine.
6. No fake safety scores.
7. No automatic “compatible package” magic.
8. Local-first and inspectable.

---

## Roadmap (near-term)

- [x] MIT license
- [x] Stable local install (`npm link` / built bins)
- [x] pnpm + Yarn classic (v1)
- [x] PyPI (`requirements.txt`+.venv, poetry, uv)
- [ ] Yarn Berry (v2+)
- [ ] GitHub Action around `scan`
- [ ] Deeper license-file detection
- [ ] Broader real-repo validation before public launch
- [ ] More rules after methodology review

---

## Contributing

Pre-MVP. High-value help:

- false-positive / false-negative fixtures
- clearer rule reasons (still non-legal in tone)
- ecosystem parsers
- docs that reduce overclaim risk

Please read [limitations.md](./limitations.md) and [legal-disclaimer.md](./legal-disclaimer.md) before proposing “make it approve licenses automatically.” That is out of scope.

Strategy doc: [`../ai_native_license_advisor_strategy.md`](../ai_native_license_advisor_strategy.md)
