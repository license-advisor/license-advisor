# Limitations

License Advisor is a **decision-support** tool. It is intentionally conservative and incomplete.

## What it does well today

- Reads npm `package-lock.json` (v2/v3), `pnpm-lock.yaml`, and Yarn classic `yarn.lock` (v1)
- Reads PyPI projects via `requirements.txt` + local `.venv`/`venv`, or `poetry.lock` / `uv.lock`
- Distinguishes direct vs transitive dependencies
- Resolves common SPDX licenses from lockfile / installed METADATA + LICENSE fingerprints
- Evaluates a small deterministic rule pack against your declared shipping intent
- Explains findings with evidence and assumptions
- Exposes the same engine through CLI and MCP

## What it does not do

- Provide legal advice or legal approval
- Cover every license ever written
- Fully encode linking doctrine (LGPL and similar edge cases)
- Automatically recommend "compatible alternative packages"
- Replace enterprise SCA platforms (FOSSA, Snyk, Sonatype, Mend, ORT, etc.)
- Guarantee that `clear` means "safe to ship forever"

## Known technical limits

| Area | Current limit |
|---|---|
| JS ecosystems | npm, pnpm, Yarn classic (v1). Yarn Berry not yet |
| PyPI without venv | `requirements.txt` alone is rejected; install into `.venv` first. `poetry.lock`/`uv.lock` without venv lists packages but may leave licenses unresolved |
| License detection | Lightweight fingerprints, not ScanCode-depth detection |
| Rule pack | High-frequency families first; many licenses still map to review states |
| Architecture facts | Linking / modification / isolation are user-declared, not inferred from code |
| False comfort risk | Prefer extra caution over a wrong `clear` |

## How to stay safe while using it

1. Keep `project-context.yaml` honest and up to date.
2. Read assumptions on every material finding.
3. Treat `red_flag` / `review_required` as triage signals, not final law.
4. Escalate ambiguous cases to qualified counsel.
5. Re-scan when dependencies or shipping plans change.

## Roadmap-shaped gaps

These may come later, but are not promised:

- GitHub Action / CI wrappers
- Yarn Berry, Maven, Go, crates, …
- Deeper license file detection
- Registry-backed license fill for lockfile-only PyPI scans
- Team policy packs / hosted history

If a gap blocks you, open an issue with a concrete repository scenario.
