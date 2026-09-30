# MCP setup

License Advisor exposes a local **stdio MCP server** so AI coding agents can run the same deterministic engine used by the CLI.

This is not an "AI lawyer."  
The tools return structured alerts. The agent should explain them calmly.

---

## Principles for agents

1. Call tools with an accurate `project_root` / context.
2. Present findings as **alerts under assumptions**, never as legal verdicts.
3. Echo assumptions on material findings.
4. Do **not** invent package alternatives.
5. Do **not** convert `clear` into "approved to ship."
6. Prefer `explain_finding` over free-form improvisation.

---

## Tools

| Tool | Input highlights | Returns |
|---|---|---|
| `scan_project` | `project_root`, optional context/lockfile | Summary, findings, assumptions, exit hints |
| `explain_finding` | `finding_id` or `package_name` | Evidence-backed explanation text + finding object |
| `check_dependency` | `package_name` | License resolutions + matching findings |
| `get_dependency_path` | `package_name` | Graph path / introduced-by |
| `get_project_context` | optional `context_path` | Current shipping intent |
| `update_project_context` | intent fields + optional `create_if_missing` | Updated context file |
| `list_outcomes` | none | Outcome taxonomy |

---

## Install the CLI / MCP binary

From this repo (recommended while developing):

```bash
npm install
npm run build
npm link
```

That puts `license-advisor` and `license-advisor-mcp` on your PATH.

Verify:

```bash
license-advisor help
license-advisor-mcp
# (MCP speaks stdio; Ctrl+C to stop if launched alone)
```

You can also run without linking:

```bash
npm run mcp
# or
node dist/mcp/server.js
```

Environment:

| Variable | Meaning |
|---|---|
| `LICENSE_ADVISOR_ROOT` | Default project root when tool calls omit `project_root` |

Tip: prefer passing `project_root` in each tool call. Then you often do not need `LICENSE_ADVISOR_ROOT`.

---

## Cursor (no hardcoded absolute paths)

### Option A - after `npm link` (simplest)

In the **target app** `.cursor/mcp.json` (or Cursor user MCP settings):

```json
{
  "mcpServers": {
    "license-advisor": {
      "command": "license-advisor-mcp"
    }
  }
}
```

Ask the agent to scan with `project_root` set to the workspace folder.

### Option B - run from this checkout via `cwd`

```json
{
  "mcpServers": {
    "license-advisor": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "cwd": "../licenses-saas"
    }
  }
}
```

Use a relative `cwd` from the app repo, or an absolute path only if you must.

### Option C - file dependency inside the app

```bash
npm install -D ../licenses-saas
```

```json
{
  "mcpServers": {
    "license-advisor": {
      "command": "npx",
      "args": ["license-advisor-mcp"]
    }
  }
}
```

Example checked into this repo: [`../examples/mcp.cursor.json`](../examples/mcp.cursor.json)

---

## Claude Code / other MCP clients

```bash
license-advisor-mcp
```

or:

```bash
node /path/to/license-advisor/dist/mcp/server.js
```

Ensure Node 20+ is on `PATH`.

---

## Recommended agent workflow

### First-time project

1. `update_project_context` with `create_if_missing=true`
2. Set:
   - `delivery`
   - `commercial`
   - `source_visibility`
   - `customer_distribution`
   - `network_access`
3. `scan_project`
4. For each high-priority finding:
   - `explain_finding`
   - `get_dependency_path`

### Before shipping

1. Confirm context still matches the product
2. `scan_project`
3. Review `red_flag` / `review_required` / `conflict`
4. Escalate unresolved cases to a human

### Example user ask

> I am building a paid SaaS for third parties. Are there licensing red flags?

Agent should:

1. ensure context says hosted/commercial/closed/network
2. call `scan_project`
3. explain any `red_flag` with path + evidence
4. avoid legal absolutism

---

## Fixture smoke test via tools

Against this repo's fixture:

- `project_root`: `.../fixtures/saas-agpl`
- expect `red_flag` on `agpl-lib`
- path: `fixture-saas-agpl → plugin-x → agpl-lib`

Handler-level selftest:

```bash
npm run test:mcp
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No supported manifest | Wrong root / unsupported lockfile | Set `project_root`; need npm/pnpm/yarn v1 or PyPI manifests |
| "Invalid project context" | Missing/invalid YAML | `init` or `update_project_context` |
| Unexpected clear/red_flag | Wrong intent | Re-check `source_visibility`, `network_access`, distribution |
| Agent invents replacements | Prompt drift | Remind: no alternatives engine; alert only |
| `license-advisor-mcp` not found | Not linked/built | `npm run build && npm link` |

---

## Related docs

- [quickstart.md](./quickstart.md)
- [outcomes.md](./outcomes.md)
- [limitations.md](./limitations.md)
- [legal-disclaimer.md](./legal-disclaimer.md)
