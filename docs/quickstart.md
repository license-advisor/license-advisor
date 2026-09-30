# Quickstart

Get from zero to a useful alert in a few minutes.

## 1. Install

```bash
cd license-advisor
npm install
npm run build
npm link
```

Requires **Node.js 20+**.

After `npm link`, these commands work from any directory:

```bash
license-advisor
license-advisor-mcp
```

## 2. Open the interactive wizard (recommended)

```bash
license-advisor
# or from this repo without linking:
npm start
```

Then choose:

1. **Configure project intent**
2. Answer the shipping questions
3. **Scan this project** (or confirm when asked)

That creates/updates `project-context.yaml` and runs the deterministic engine.

## 3. Or configure manually

```bash
license-advisor init --name my-app
```

Edit the important fields:

- `delivery` e.g. `hosted_saas`
- `commercial` `yes` / `no` / `undecided`
- `source_visibility` usually `closed` for private products
- `customer_distribution` `none` for hosted SaaS
- `network_access` `true` for web apps / APIs

Then:

```bash
license-advisor scan
```

Useful variants:

```bash
license-advisor scan --json
license-advisor scan --markdown
```

## 4. Inspect a red flag

From the wizard: **Explain a finding** / **Inspect a dependency path**

Or via commands:

```bash
license-advisor deps why <package>
license-advisor licenses show <package>
```

## 5. Optional: MCP in Cursor / Claude Code

```bash
npm run build && npm link
```

Then use [`examples/mcp.cursor.json`](../examples/mcp.cursor.json) (`command: license-advisor-mcp`).

Full guide: [mcp-setup.md](./mcp-setup.md).

## Try the built-in SaaS + AGPL fixture

```bash
npm run dev -- scan \
  --path fixtures/saas-agpl/project-context.yaml \
  --lockfile fixtures/saas-agpl/package-lock.json
```

Expected signal: a `red_flag` on transitive `agpl-lib` for a closed-source hosted SaaS context.

## Try the PyPI fixture

```bash
npm run dev -- scan \
  --path fixtures/pypi/project-context.yaml \
  --lockfile fixtures/pypi/requirements.txt
```

Needs the fixture's `.venv` METADATA tree (checked in). Expected signal: `red_flag` on `agpl-tool`.
