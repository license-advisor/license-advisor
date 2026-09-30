<p align="center">
  <img src="assets/logo.jpg" alt="License Advisor logo" width="128" height="128" />
</p>

<h1 align="center">License Advisor</h1>

<p align="center">
  <strong>An open-source licensing advisor for builders who ship with AI tools.</strong><br />
  Tell it how you plan to ship. It alerts on dependency license issues that matter for that plan.
</p>

<p align="center">
  <a href="#try-it-in-5-minutes"><img src="https://img.shields.io/badge/try%20it-5%20min-0F3D3E?style=for-the-badge" alt="Try it" /></a>
  <a href="#use-it-with-your-ai-coding-agent"><img src="https://img.shields.io/badge/works%20with-Cursor%20%2F%20MCP-163A5F?style=for-the-badge" alt="MCP" /></a>
  <a href="docs/legal-disclaimer.md"><img src="https://img.shields.io/badge/not-legal%20advice-7A2E0E?style=for-the-badge" alt="Not legal advice" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-pre--MVP-yellow?style=flat-square" alt="Status: pre-MVP" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square" alt="Node >= 20" />
  <img src="https://img.shields.io/badge/npm%20%7C%20pnpm%20%7C%20yarn%20%7C%20PyPI-0F3D3E?style=flat-square" alt="Supported ecosystems" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT license" />
</p>

---

## Why this exists

Modern builders (especially with AI coding agents) can install dozens of transitive dependencies in seconds.

Security scanners are common.  
**Contextual licensing alerts are not.**

Most tools answer:

> What license is this package?

Builders actually need:

> I am shipping a paid closed-source SaaS. What in this tree deserves attention before I commercialize?

License Advisor is built for that second question.

---

## What it does

1. You declare how you ship (hosted SaaS, open source, SDK to customers, and so on)
2. It reads your real dependency tree and license evidence
3. It returns **alerts under those assumptions**, with paths and sources - not a fake "94% safe" score, and not a legal verdict

**Core rule:** you state intent. The rules engine decides what is known. The LLM only explains.

It is not a law firm, not an SCA dashboard clone, and not a package-replacement recommender.

Disclaimer: [`docs/legal-disclaimer.md`](docs/legal-disclaimer.md)

---

## How it works

```text
  Your shipping intent          Your lockfile / requirements
  (project-context.yaml)        (npm, pnpm, yarn, or PyPI)
            |                              |
            v                              v
     How you plan to ship          Dependency graph
                                   + license evidence
            |                              |
            +--------------+---------------+
                           |
                           v
                  Deterministic rules
                           |
                           v
              Findings: clear / notice /
              red_flag / review_required / ...
                           |
              +------------+------------+
              |                         |
              v                         v
             CLI                       MCP
        (you in terminal)        (Cursor / agents)
```

Every material finding includes package and version, direct vs transitive path, license evidence, rule id, **assumptions used**, and explicit limits.

---

## Who it is for

- Builders shipping SaaS or products with Cursor, Claude Code, and similar tools
- Beginners who want a structured second look at licenses
- Testers and early adopters evaluating a pre-MVP open-source tool

**Supported today:** npm, pnpm, Yarn classic (v1), and Python (`requirements.txt` + `.venv`, or `poetry.lock` / `uv.lock`).

What we do not cover yet: [`docs/limitations.md`](docs/limitations.md)

---

## Try it in 5 minutes

Requires **Node.js 20+**.

```bash
git clone https://github.com/license-advisor/license-advisor.git
cd license-advisor
npm install
npm run build
npm link
```

### Option A: guided wizard (recommended)

```bash
cd /path/to/your-app
license-advisor
```

Configure shipping intent, run a scan, then inspect anything flagged.

### Option B: two commands

```bash
cd /path/to/your-app
license-advisor init --name my-app
license-advisor scan
```

### Demo without your own app

From this repository:

```bash
npm run dev -- scan \
  --path fixtures/saas-agpl/project-context.yaml \
  --lockfile fixtures/saas-agpl/package-lock.json
```

Expected signal:

```text
[red_flag] agpl-lib@2.1.0
  rule:    AGPL_NETWORK_001
  path:    fixture-saas-agpl → plugin-x → agpl-lib
  why:     closed-source + network-accessible SaaS context
```

That means: under those assumptions, this dependency deserves review. It does not mean "this is illegal."

Step-by-step: [`docs/quickstart.md`](docs/quickstart.md)

---

## Use it with your AI coding agent

Same MCP server everywhere. Node.js 20+ required. No need to clone the repo for everyday use.

Shared launch command:

```text
npx -y --package=github:license-advisor/license-advisor license-advisor-mcp
```

### Cursor

[![Add to Cursor](https://img.shields.io/badge/Add%20to-Cursor-163A5F?style=for-the-badge)](https://cursor.com/en/install-mcp?name=license-advisor&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi0tcGFja2FnZT1naXRodWI6bGljZW5zZS1hZHZpc29yL2xpY2Vuc2UtYWR2aXNvciIsImxpY2Vuc2UtYWR2aXNvci1tY3AiXX0%3D)

Or put this in `.cursor/mcp.json` / Cursor MCP settings:

```json
{
  "mcpServers": {
    "license-advisor": {
      "command": "npx",
      "args": [
        "-y",
        "--package=github:license-advisor/license-advisor",
        "license-advisor-mcp"
      ]
    }
  }
}
```

### Claude Desktop

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config), then fully quit and reopen Claude:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "license-advisor": {
      "command": "npx",
      "args": [
        "-y",
        "--package=github:license-advisor/license-advisor",
        "license-advisor-mcp"
      ]
    }
  }
}
```

If Claude cannot find `npx`, set `command` to the absolute path from `which npx` / `where npx`.

### Claude Code

```bash
claude mcp add --transport stdio license-advisor -- \
  npx -y --package=github:license-advisor/license-advisor license-advisor-mcp
```

Then check with `/mcp`. Docs: [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)

### OpenAI Codex

CLI:

```bash
codex mcp add license-advisor -- \
  npx -y --package=github:license-advisor/license-advisor license-advisor-mcp
```

Or in `~/.codex/config.toml` (or project `.codex/config.toml`):

```toml
[mcp_servers.license-advisor]
command = "npx"
args = [
  "-y",
  "--package=github:license-advisor/license-advisor",
  "license-advisor-mcp"
]
```

Docs: [Model Context Protocol in Codex](https://developers.openai.com/codex/mcp/)

### Example asks (any client)

```text
I'm shipping a paid closed-source SaaS. Scan this project for licensing red flags.
```

```text
Explain the highest-priority finding and show the dependency path.
```

```text
Why is package X in my tree, and what license did we conclude?
```

```text
Update my shipping intent for hosted SaaS (commercial, closed source, no customer distribution, network on), then rescan.
```

The agent should call License Advisor tools (`scan_project`, `explain_finding`, and related). It should not invent a license table on its own.

Full MCP setup (local link, checkout, troubleshooting): [`docs/mcp-setup.md`](docs/mcp-setup.md)

Later: npm publish + official Cursor Marketplace plugin. Community listings can also go on [cursor.directory](https://cursor.directory).

---

## How to read the results

| Outcome | Meaning in practice |
|---|---|
| `clear` | No material issue found under your stated plan |
| `notice` | Manageable obligation (often attribution / NOTICE) |
| `red_flag` | Real tension with that plan; review before shipping |
| `review_required` | Automation is not enough; human judgment needed |
| `conflict` | Hard clash with what you declared |

Wrong intent produces wrong alerts. If your product model changes, update `project-context.yaml` and scan again.

More on tone and outcomes: [`docs/outcomes.md`](docs/outcomes.md)

---

## Go deeper

| Topic | Document |
|---|---|
| First successful scan | [`docs/quickstart.md`](docs/quickstart.md) |
| MCP / Cursor setup | [`docs/mcp-setup.md`](docs/mcp-setup.md) |
| CLI, ecosystems, repo map, contributing | [`docs/reference.md`](docs/reference.md) |
| Rule pack | [`docs/rule-matrix-v0.md`](docs/rule-matrix-v0.md) |
| Limits | [`docs/limitations.md`](docs/limitations.md) |
| Legal framing | [`docs/legal-disclaimer.md`](docs/legal-disclaimer.md) |

---

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>
    Makes licensing implications visible and discussable, without pretending to be your lawyer.
  </sub>
</p>
