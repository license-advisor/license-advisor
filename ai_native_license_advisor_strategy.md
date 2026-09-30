# AI-Native Open Source License Advisor
## Product Strategy, Business Plan & Technical Blueprint

**Status:** Exploration / Pre-MVP  
**Date:** September 2026  
**Working concept:** An open-source licensing advisor for software builders that scans a project, understands how the software is intended to be used or commercialized, detects licensing obligations and red flags, and explains the implications in plain language - while keeping the legal/compliance decision engine deterministic and auditable.

> **Important positioning:** This product is not a law firm and does not provide legal advice. It is a software compliance decision-support tool. It should make assumptions explicit, cite the license terms and rules used, show uncertainty, and recommend professional legal review when a scenario cannot be resolved safely by deterministic rules.
>
> **Product promise:** Alert and explain. Never sentence. Never invent certainty.

---

# 1. Executive Summary

The opportunity is not to build another dependency-license scanner.

The market already has mature Software Composition Analysis (SCA) products that identify open-source dependencies, licenses, vulnerabilities, policy violations, and attribution requirements. FOSSA, Snyk, Sonatype, Mend, OSS Review Toolkit (ORT), ScanCode, Socket and others cover meaningful parts of this space.

The product opportunity explored here is different:

**Turn license awareness into an AI-native, conversational, context-aware development workflow for people building software quickly with tools such as Cursor, Claude Code, Codex, GitHub Copilot, Lovable, Replit and similar environments.**

A builder should be able to say:

> “I am building a paid SaaS for third parties.”

and ask:

> “Are there licensing red flags in this project for that plan?”

and receive something closer to:

> “Under your stated context (commercial closed-source SaaS, network-accessible, not distributing binaries to customers), most dependencies look clear. One transitive dependency deserves attention: package C is AGPL-3.0. AGPL includes a network-use source availability condition that can conflict with a closed-source hosted model. Path: `app → framework-a → plugin-b → package-c`. Evidence: package metadata + LICENSE file. Assumptions used: …. This is a red flag to review - not a legal conclusion.”

The differentiator is the combination of:

- the builder’s **shipping / commercialization intent** as first-class input;
- deterministic license and dependency analysis;
- plain-language **alerts**, not verdicts;
- AI-native interfaces, especially MCP;
- transparent evidence and traceability;
- continuous checks as the project evolves;
- a UX designed for modern software builders, not only legal/compliance teams.

**What this product is not:**

- not an alternatives recommender that invents “compatible replacements”;
- not a legal approver;
- not a percentage-based “safe to ship” score;
- not an LLM that invents legal conclusions;
- not another enterprise SCA dashboard in disguise.

**Recommendation:** Prototype as an **open-source, local-first licensing advisor** with CLI and MCP. The LLM is a thin explanation layer. The core is project context + deterministic rules + evidence. Defer monetization, SaaS dashboards, and any “suggest a safer package” engine until real usage proves demand. Validate with a thin prototype in weeks, not a platform build in months.

---

# 2. The Problem

## 2.1 Software builders routinely inherit legal obligations without noticing

Modern applications may contain hundreds or thousands of direct and transitive packages. A developer can add one dependency with a single command and indirectly introduce dozens of additional components.

The technical act is trivial:

```bash
npm install package-x
```

The licensing consequences are not.

Depending on the license, the way the component is linked, modified, distributed, hosted or offered over a network can change the obligations.

Most builders do not inspect this manually. Even experienced developers frequently focus on:

- functionality;
- security vulnerabilities;
- package maintenance;
- performance;
- popularity;
- API quality.

Licensing tends to become visible only during:

- enterprise procurement;
- due diligence;
- acquisition;
- customer security/compliance review;
- release preparation;
- legal review;
- an incident.

AI-assisted development amplifies the problem because dependencies can be introduced faster than humans review them. A large wave of vibe coders and AI-first builders is shipping real apps - including paid apps - with little or no license hygiene.

## 2.2 The question builders actually care about is not “What license is this?”

The practical question is:

**“Given what I am building and how I plan to use, distribute and monetize it, what should I pay attention to?”**

A raw result such as:

> `AGPL-3.0-only`

is accurate but insufficient for many users.

The builder needs the product to connect:

1. the dependency;
2. the exact version;
3. the license evidence;
4. where it enters the dependency graph;
5. the project’s usage/distribution intent;
6. the relevant obligations or red flags;
7. the assumptions behind the alert;
8. what remains uncertain.

The product’s job is **awareness and triage**, not automatic remediation and not legal judgment.

---

# 3. Target Audience

The primary audience should not be described as “non-technical.”

A better category is:

## AI-native software builders

People who build real software using a combination of traditional development and AI-assisted tools, including:

- professional software engineers;
- indie hackers;
- startup founders;
- product engineers;
- technical founders;
- freelancers and agencies;
- internal automation teams;
- “vibe coding” / AI-first builders who can ship applications without deep software-compliance expertise.

The product should remain credible to senior engineers and compliance teams while being understandable to someone who has never read an open-source license.

## Why this audience matters now

There is a growing population of people with apps already in the market - or about to launch - who:

- ship faster than compliance processes expect;
- install dependencies via AI agents;
- may only discover licensing issues during a client review, investment diligence, or acquisition.

An advisor that surfaces red flags early can still create value even when the user does not immediately change a dependency. **Being alerted is itself the job.** Changing behavior is a desirable outcome, not the only definition of success - especially for an open-source awareness tool.

## Secondary audiences

- Engineering managers
- DevOps / platform teams
- Security teams
- Open Source Program Offices (OSPOs)
- Procurement teams
- Legal/compliance teams
- Software consultancies and agencies

Secondary audiences may matter later for adoption depth. They are not the initial wedge.

---

# 4. Product Thesis

The product should be thought of as:

> **“A licensing advisor with a deterministic compliance engine underneath.”**

Not:

> “An LLM that tells you whether a license is safe.”

Not:

> “A tool that sentences your project as legal or illegal.”

Not:

> “A magic recommender of compatible alternative packages.”

## Core principle

**The user states intent. The rules engine evaluates what is known. The LLM explains. Nothing invents legal certainty.**

The deterministic layer should produce structured findings such as:

```json
{
  "dependency": "example-lib",
  "version": "4.2.1",
  "license_expression": "AGPL-3.0-only",
  "relationship": "transitive",
  "introduced_by": ["framework-x", "plugin-y"],
  "usage_context": {
    "business_model": "commercial_saas",
    "distributed_to_customers": false,
    "network_service": true,
    "modified_dependency": false
  },
  "finding": {
    "severity": "red_flag",
    "rule_id": "AGPL_NETWORK_INTERACTION_001",
    "reason": "Network interaction may trigger source-code availability obligations under AGPL for a closed-source hosted model."
  },
  "assumptions": [
    "Project remains closed-source",
    "Dependency is used in a network-accessible service",
    "No customer distribution of binaries/source"
  ],
  "evidence": [
    "package metadata",
    "detected LICENSE file",
    "SPDX expression"
  ]
}
```

The LLM can then transform this into a useful explanation while preserving the evidence and assumptions.

## Advisor, not sentencer

The system should say how far the analysis can go and where it must stop.

Good:

> “Under your stated intent, this looks like a red flag. Here is why, here is the evidence, here are the assumptions.”

Bad:

> “You are legally forbidden from using this package.”

Also bad:

> “Probably fine.”

Also bad:

> “Replace it with package Y.”

---

# 5. What Already Exists

This is an established market category: **Software Composition Analysis (SCA)** and open-source license compliance.

## FOSSA

FOSSA provides dependency analysis, license/security/quality analysis, policies, reports and a CLI designed to run locally or in CI. Its CLI analyzes dependencies and uploads results to FOSSA for further analysis.

**Strength:** mature enterprise license-compliance workflow.  
**Gap relative to this concept:** primarily an enterprise/compliance product rather than a builder-first advisor centered on a natural-language shipping scenario.

## Snyk

Snyk Open Source scans dependencies for security and license issues and integrates into developer workflows and CI/CD.

**Strength:** broad developer adoption and security integration.  
**Gap:** license guidance is part of a broader developer-security platform; the core experience is not primarily a contextual “how may I ship this product?” advisor.

## Sonatype Lifecycle

Sonatype provides open-source governance, automated license policy enforcement, legal workflows, SBOM management and continuous monitoring.

**Strength:** sophisticated enterprise governance and policy.  
**Gap:** heavier enterprise orientation and organizational compliance workflow.

## Mend

Mend provides open-source license compliance and policy management alongside software supply-chain/security tooling.

**Strength:** enterprise policy automation and large-scale governance.  
**Gap:** similar enterprise orientation; less focused on a lightweight builder-first conversational decision layer.

## OSS Review Toolkit (ORT)

ORT is open source and highly relevant technically. It can analyze dependencies, scan licenses, evaluate policy-as-code rules, generate SBOMs and notices, and be used via libraries, CLI and CI integrations.

Its evaluator can run custom license rules and even specify “how to fix” actions.

**Strength:** powerful, auditable, extensible foundation. Prefer wrapping/orchestrating mature scanners where practical instead of reinventing dependency discovery.  
**Gap:** requires significant configuration and expertise. It is infrastructure/toolkit oriented rather than a polished conversational advisor for a builder describing a business model in natural language.

## ScanCode Toolkit

ScanCode is an open-source toolkit that detects licenses, copyrights, dependencies and package information. It can be used as CLI or library.

**Strength:** deep scanning and license detection.  
**Gap:** detection rather than full end-user contextual guidance.

## Socket MCP

Socket has an MCP server that brings dependency intelligence directly into AI assistants. Its documented MCP workflow provides package scores across supply-chain, quality, maintenance, vulnerability and license dimensions.

This is the closest signal that the market is moving toward AI-native dependency tooling.

**Strength:** excellent strategic validation for MCP as an interface.  
**Gap:** the current experience is centered on dependency intelligence and scoring, not a purpose-built licensing advisor that models the builder’s distribution/commercial context and explains obligations with legal-source traceability.

---

# 6. Competitive Positioning

| Capability | Traditional SCA | ORT / ScanCode | Socket MCP | Proposed Product |
|---|---|---|---|---|
| Dependency discovery | Strong | Strong | Strong/Package-oriented | Strong (prefer reuse/orchestration) |
| Transitive graph | Strong | Strong | Available in ecosystem | Strong |
| License detection | Strong | Strong | License signal | Strong |
| Security vulnerabilities | Strong | Varies | Strong | Out of scope |
| Policy engine | Strong enterprise | Strong / configurable | Rules possible | Strong / builder-intent driven |
| Understand shipping / business intent | Usually configured as policy | Manual/configurable | Limited | **Core** |
| Plain-language alerts | Varies | Limited | AI-assisted | **Core** |
| Non-sentencing / assumption-aware output | Varies | Limited | Limited | **Core** |
| MCP-first workflow | Emerging | No native focus | **Yes** | **Yes, central** |
| Auto-suggest “safer” package alternatives | Sometimes indirect | Manual | Possible via agent | **Not core / deferred** |
| Evidence / traceability | Strong | Strong | Strong package data | **Required** |
| Local-first open-source core | Varies | Yes | MCP client integration | **Primary strategy** |
| Builder-first onboarding | Medium | Low | High | **Very high** |

## Strategic conclusion

The market is **not empty**.

That is actually useful: the technical need is validated and the category is understood.

The opportunity is a **new product experience and decision layer**, not invention of license scanning itself.

The defensibility is mostly **UX, timing, packaging and trust design** - not a permanent technical moat. That is acceptable for an open-source advisor. It is not a reason to overclaim uniqueness.

---

# 7. The Differentiator

The strongest positioning is:

> **“Tell us how you plan to ship your software. We’ll alert you to the dependency license issues that matter for that plan - with evidence, without pretending to be your lawyer.”**

The system should understand scenarios such as:

- private/internal application;
- hosted SaaS;
- freemium SaaS;
- paid SaaS sold to third parties;
- mobile application distributed through app stores;
- desktop executable;
- on-premise enterprise installation;
- SDK/library distributed to developers;
- command-line tool;
- embedded/firmware product;
- source-available commercial project;
- open-source project;
- white-label product;
- client project delivered by an agency;
- internal tool used inside a third-party company;
- modified vs unmodified dependency;
- dynamically linked vs statically linked components where relevant to the rule pack;
- dependency used only in development/build/test;
- separate service/process vs incorporated code.

This contextual model is the core product value.

**Important:** the user’s declared intent is powerful and dangerous. If they mark the project as “internal-only” when it is actually a commercial SaaS, alerts will be wrong. Therefore every material finding must restate the assumptions, and the context file must be easy to update.

---

# 8. UX: What the Product Should Feel Like

## First-time setup

The product scans the repository and asks a small number of high-value questions:

1. **How will this software be delivered?**
   - Hosted SaaS
   - Mobile app
   - Desktop app
   - On-premise deployment
   - Library/SDK
   - Internal-only
   - Client deliverable / agency project
   - Other

2. **Is it commercial?**
   - Yes
   - No
   - Not decided

3. **Will customers or third parties receive executable/source code?**
   - Yes
   - No
   - Some components

4. **Will users interact with the software over a network?**

5. **Do you modify any open-source dependencies?**

6. **Is your own project intended to remain closed-source?**

The answers are stored as a versioned `project-policy` / `project-context` file in the repository.

Example:

```yaml
project:
  type: saas
  commercial: true
  source_visibility: closed
  customer_distribution: false
  network_access: true
  modifies_dependencies: false
  audience: third_parties
  target_platforms:
    - web
```

## Normal workflow

A builder asks their AI coding assistant:

> “Given that this is a paid SaaS, are there licensing red flags?”

The MCP tool returns:

> **Red flag - AGPL-3.0**  
> Your project is configured as a commercial closed-source SaaS. This package’s license includes a network-use condition that may require making corresponding source code available to users interacting with the modified covered software over a network.  
>
> **Why it matters under your stated intent:** your app is network-accessible and intended to remain closed source.  
> **Dependency type:** transitive.  
> **Path:** `app → framework-plugin → example-package`.  
> **Evidence:** package metadata + repository LICENSE.  
> **Assumptions used:** no customer distribution; dependency used in the hosted service; closed-source posture remains true.  
> **Limit:** this is an alert for review, not a legal determination. If the architecture isolates this component differently, update the project context or seek qualified review.

The system should avoid definitive legal language such as:

> “This is illegal.”

Instead:

> “This creates an obligation that appears incompatible with your stated closed-source distribution model.”

## Personality

The product should behave like a calm senior engineer with a checklist - not like a lawyer drafting a contract, not like a professor lecturing, and not like an AI confidently improvising.

Good:

> “This deserves attention before release. The project is configured as a closed-source SaaS, and dependency X is AGPL-3.0. The relevant issue is network interaction. Here is the path and the evidence.”

Bad:

> “You are legally forbidden from using this package.”

Bad:

> “As a best practice, you should always…”

Bad:

> “License risk score: 74/100.”

---

# 9. Risk Model

Avoid a fake “93% safe” score.

A percentage creates an impression of mathematical/legal certainty that the product cannot legitimately provide.

Use explicit statuses:

- **Clear** - no relevant obligation detected under the current project assumptions.
- **Notice** - obligations exist but are usually operationally manageable (for example attribution/notice).
- **Red flag** - meaningful conditions should be reviewed before shipping under the stated intent.
- **Insufficient context** - the system cannot evaluate safely without more information from the user.
- **Review required** - the context and license interaction cannot safely be resolved automatically; escalate to a human/expert.
- **Conflict** - a deterministic policy rule identifies an incompatibility with the project’s declared constraints.

Each result should also expose:

- confidence in **license detection**;
- confidence in **dependency relationship**;
- completeness of the scan;
- unresolved license expressions;
- assumptions used by the policy engine.

This separates factual confidence from interpretation.

**Design rule:** be non-sentencing without becoming vague. “Red flag under stated assumptions” is useful. “Maybe something something” is not.

---

# 10. License Knowledge Model

The first version does not need to cover every license ever written.

It should cover high-frequency licenses and common problem categories extremely well.

## Initial families

### Permissive
- MIT
- BSD-2-Clause
- BSD-3-Clause
- Apache-2.0
- ISC

### Weak copyleft
- LGPL family
- MPL-2.0
- EPL family

### Strong copyleft
- GPL-2.0
- GPL-3.0

### Network copyleft
- AGPL-3.0

### Special / source-available / non-standard
- Business Source License variants
- SSPL
- Elastic License
- Commons Clause combinations
- PolyForm licenses
- custom commercial licenses

The system should distinguish **open source** from **source available** rather than treating every GitHub repository as “open source.”

## Important nuance

License behavior cannot be reduced to one simplistic rule.

For example:

- GPL obligations are generally associated with conveying/distributing covered works; the exact analysis depends on how software is combined and distributed.
- AGPL adds an explicit network-interaction provision that can matter to hosted services.
- LGPL is designed to permit certain forms of use/linking under conditions, but architecture and modification details can matter.
- Apache-2.0 includes patent-related terms and notice requirements.
- Dual-licensed packages may allow the user to choose one of multiple licenses.
- A package’s declared metadata may not perfectly reflect licenses detected inside its source.
- Some packages change license between versions.

This is precisely why the output must show evidence and assumptions.

---

# 11. Technical Architecture

## Recommended architecture

```text
Repository
   |
   v
Dependency Discovery
   |
   +--> package manifests / lockfiles
   +--> transitive dependency graph
   +--> source/license files
   |
   v
License Resolution Layer
   |
   +--> SPDX normalization
   +--> declared license
   +--> detected license
   +--> concluded/effective license
   +--> version-specific metadata
   |
   v
Project Context Engine
   |
   +--> SaaS / distribution / mobile / library / internal
   +--> commercial / noncommercial
   +--> source visibility
   +--> network interaction
   +--> linking / modification / bundling
   |
   v
Deterministic Policy Engine
   |
   +--> policy rules
   +--> obligations
   +--> red flags
   +--> conflicts
   +--> insufficient-context / review-required cases
   |
   v
Evidence Bundle
   |
   +--> rule ID
   +--> license text/source
   +--> dependency path
   +--> assumptions
   +--> scan timestamp/version
   |
   +--------------------------+
   |                          |
   v                          v
CLI / CI                   MCP Server
   |                          |
   v                          v
Human-readable report     AI coding assistant
                              |
                              v
                       LLM explanation layer
                       (thin; schema-bound)
```

## Core rule

The LLM should receive a **structured decision package**, not raw authority to decide.

Prefer reusing or orchestrating mature open-source components (for example ORT / ScanCode / package-manager metadata) for discovery and detection. The proprietary-feeling value of this project is the **intent model + alert UX + evidence packaging + MCP workflow**, not a from-scratch license scanner.

---

# 12. Interface Strategy

## Phase 1 - CLI

Example:

```bash
licenseguard init
licenseguard scan
licenseguard explain package-x
licenseguard why package-x
licenseguard context show
licenseguard context update
```

Why CLI first:

- easiest to test;
- local-first;
- works across languages/editors;
- natural fit for CI;
- establishes the core engine independently of any AI provider.

## Phase 2 - MCP

Example tools:

```text
scan_project
check_dependency
explain_finding
get_dependency_path
update_project_context
get_project_context
compare_dependency_licenses
generate_notice
```

MCP is strategically important because it lets the product live inside:

- Claude Code;
- Cursor;
- Codex-style workflows;
- VS Code / Copilot integrations;
- other MCP-compatible agents.

The user does not need to remember to visit a compliance dashboard.

The agent can call:

> `check_dependency("package-x", "1.4.2")`

when the builder asks about shipping risk or before adding a dependency.

**Retention note:** MCP is distribution, not habit. The product should be designed for high-value moments - init, pre-ship, “can I commercialize this?”, PR review - rather than pretending it is always-on observability from day one. Later hooks (install-time checks, CI gates, agent rules) can increase recurrence if usage warrants them.

## Phase 3 - GitHub Action / CI

The project should support policies such as:

```yaml
fail_on:
  - conflict

warn_on:
  - red_flag
  - review_required
```

Pull request comment:

> “This PR adds 14 packages. 12 are clear, 1 requires notice, and 1 introduces AGPL-3.0 into a project configured as closed-source SaaS.”

## Phase 4 - Optional hosted / team features

Only if organic usage demonstrates need. Not part of the initial bet.

Possible later features:

- organization-wide policies;
- project inventory;
- scan history;
- repository fleet monitoring;
- exceptions/approvals;
- audit trail;
- reporting;
- SBOM storage;
- Slack/Jira integrations.

These are hypotheses, not commitments. The project starts as open source without a pricing plan.

---

# 13. Open Source Strategy

## Primary recommendation: open source first

The trust problem is unusually important here.

Developers will hesitate to rely on a black box that tells them whether they can ship their software.

For an advisor that alerts on licensing risk, open source is not a temporary go-to-market trick. It is the credible default.

### Open source scope

- dependency scanner orchestration;
- SPDX normalization;
- project-context schema;
- common license rule definitions;
- CLI;
- local reports;
- local MCP server;
- evidence format;
- CI / GitHub Action basics;
- documentation of methodology and limitations.

### Explicitly deferred

- monetization / paid tiers;
- hosted organization dashboard;
- “safer alternatives” recommendation engine;
- enterprise sales motion;
- attempting to replace Snyk/FOSSA/Socket.

## Why not optimize for pricing now

There is no clear early willingness-to-pay among individual vibe coders and indie builders for license awareness alone. That does not invalidate the product. It means:

1. ship a useful open-source advisor;
2. measure whether people run it, trust it, and share it;
3. only later decide whether any hosted/team layer deserves to exist.

If the tool is used once before launch and surfaces a real red flag the owner did not know about, the open-source job was done. Recurring team governance value - if any - comes later.

Adoption path:

```text
Developer discovers project
        ↓
Runs locally for free
        ↓
Adds MCP to AI coding tool
        ↓
Uses it at init / pre-ship / “can I commercialize?”
        ↓
Optionally adds CI check
        ↓
If teams need shared policy / history / fleet visibility,
consider a later hosted layer
```

---

# 14. Business Model

**Current decision: no pricing model.**

Do not invent charges before validating usage.

If a commercial layer ever appears, monetize coordination, scale, governance and continuously maintained intelligence - not the basic act of telling one developer that a dependency uses MIT.

Until then, success metrics are open-source adoption metrics:

- installs / clones;
- repeat scans;
- MCP configurations;
- stars / shares / referrals;
- issues that improve false-positive quality;
- “I found something I didn’t know” reports.

A particularly valuable qualitative signal:

> “This alert changed what I paid attention to before shipping.”

Changing a dependency is strong evidence. Merely becoming aware of a red flag is already useful evidence for an advisor.

---

# 15. Go-to-Market Strategy

The product should enter through developers, not through legal procurement.

## Initial wedge

**“Before your AI agent installs another dependency, let it check whether that dependency fits how you plan to ship your product.”**

That is specific, modern and immediately understandable.

## Distribution

- GitHub open-source repository
- npm / PyPI / Homebrew or equivalent install
- MCP directories/marketplaces
- Cursor/Claude Code setup recipes
- GitHub Action marketplace
- developer communities
- Hacker News
- Reddit developer communities
- Product Hunt
- technical LinkedIn content
- short educational demos

## Content strategy

Excellent content themes include:

- “Your AI agent installed 73 dependencies. Who checked their licenses?”
- “MIT is easy. AGPL is where your SaaS assumptions start to matter.”
- “Open source does not always mean ‘do whatever you want.’”
- “The dependency four levels deep that changes your distribution obligations.”
- “Why AI coding makes software-license hygiene more important, not less.”
- “A green security scan does not mean your dependency is commercially compatible.”
- “This tool alerts. It does not approve.”

---

# 16. The Ideal Viral Demo

A compelling demo should be less than two minutes.

### Scenario

1. Open a real AI-built SaaS repository.
2. Set context:
   > “Paid SaaS, closed source, hosted, network access.”
3. Ask the agent:
   > “Are there licensing red flags if I commercialize this?”
4. MCP scans the project.
5. It responds:
   > “Mostly clear under your stated assumptions. One dependency deserves attention.”
6. Expand the dependency path:
   > `your-app → framework-a → plugin-b → package-c`
7. Show:
   > `package-c: AGPL-3.0`
8. Explain why it matters to this specific SaaS configuration, with evidence and assumptions.
9. Stop there - or optionally show how to update context / generate a report for human review.

Do **not** center the demo on automatic package replacement. That overpromises a fragile capability.

That demonstration communicates the product instantly: intent in, alert out, evidence attached.

---

# 17. Alternatives Recommendation - Explicitly Deferred

Automatically suggesting “compatible” alternatives is attractive and fragile.

Problems:

- functional similarity is hard to get right;
- API breakage risk;
- inconsistent quality;
- ongoing maintenance cost;
- responsibility if a suggestion is bad;
- agents may over-trust a ranked replacement list.

**Decision for this project:**

- **Not core.**
- **Not MVP.**
- **Not a competitive claim.**

If ever revisited, do it conservatively:

> “Other packages in a similar category often use more permissive licenses. Verify functionality and migration cost manually.”

No auto-replace. No confident ranking. No pretending the tool knows the best substitute.

The product wins by alerting well, not by remediating magically.

---

# 18. Data and Evidence Sources

The project can combine multiple sources:

- package-manager metadata;
- package lockfiles;
- repository LICENSE/COPYING files;
- SPDX identifiers and license list;
- ScanCode license detection;
- ORT components;
- ClearlyDefined data where appropriate;
- Git hosting metadata;
- package registries;
- SBOM formats such as SPDX and CycloneDX.

The engine should retain provenance:

```json
{
  "license": "Apache-2.0",
  "sources": [
    {
      "type": "package_metadata",
      "value": "Apache-2.0"
    },
    {
      "type": "license_file_detection",
      "value": "Apache-2.0",
      "confidence": 0.998
    }
  ]
}
```

Never flatten contradictory evidence silently.

---

# 19. Trust and Safety Design

This product succeeds or fails on trust.

## Mandatory principles

### 1. No hallucinated license
If a license cannot be confidently identified:

> **Unknown - review required**

not:

> “Probably MIT.”

### 2. Cite the evidence
Every material conclusion should be traceable.

### 3. Show assumptions
For example:

> “This finding assumes the dependency is only used server-side and is not distributed.”

### 4. Version everything
- ruleset version;
- scanner version;
- package version;
- project-context version;
- timestamp.

### 5. Separate facts from interpretation
Example:

**Fact:** Dependency X declares `AGPL-3.0-only`.  
**Context:** Product is configured as closed-source hosted SaaS.  
**Rule outcome:** Red flag / review required.  
**Explanation:** Network interaction may create source availability obligations.

### 6. Legal escalation
Some scenarios should intentionally stop:

> “This case depends on how your application combines with the library. Automated analysis is insufficient. Review with qualified counsel.”

That is a feature, not a weakness.

### 7. Pessimism over false comfort
A false “Clear” is worse than an extra red flag. Prefer conservative outcomes when evidence or architecture is incomplete.

### 8. No professorial tone
Do not lecture. Do not moralize. Do not perform legal authority. Alert, show evidence, state limits.

---

# 20. Why a Percentage Score Is a Bad Primary UX

A “94% safe” badge looks attractive but creates several problems:

- legal obligations are not probabilistic in that way;
- a highly confident license detection can coexist with an ambiguous architectural interpretation;
- users may interpret 94% as permission to proceed;
- it obscures assumptions;
- it is difficult to defend.

If numerical confidence is used, restrict it to technical evidence:

- 99.8% license-text detection confidence;
- dependency graph complete for 100% of lockfile entries;
- 2 packages unresolved.

The policy outcome should remain categorical.

---

# 21. MVP Scope

The MVP should prove one thesis:

> **Can the product correctly turn a repository + shipping intent into materially useful license alerts inside an AI coding workflow?**

## MVP must-have

- JavaScript/TypeScript npm ecosystem first
- dependency graph
- direct vs transitive dependencies
- license normalization to SPDX
- top 15 - 25 common license families
- project-context questionnaire / file
- deterministic rule engine
- CLI
- MCP server
- calm, non-legal human-readable alerts
- dependency path
- evidence + assumptions
- JSON output for agents
- Markdown report
- CI exit codes

## Explicitly not MVP

- package alternatives / auto-remediation;
- full enterprise dashboard;
- pricing / billing;
- every programming ecosystem;
- automatic legal approval;
- vulnerability scanner replacement;
- full SBOM management platform;
- dozens of integrations;
- professorial or lawyer-like copy.

## Optional stretch after npm works

- Python / PyPI support
- richer notice generation
- install-time or agent-rule hooks for recurrence

---

# 22. Suggested Repository Architecture

```text
license-advisor/
├── packages/
│   ├── core/
│   │   ├── dependency_graph/
│   │   ├── license_resolution/
│   │   ├── context/
│   │   ├── policy_engine/
│   │   └── evidence/
│   │
│   ├── rules/
│   │   ├── permissive/
│   │   ├── weak_copyleft/
│   │   ├── strong_copyleft/
│   │   ├── network_copyleft/
│   │   └── source_available/
│   │
│   ├── cli/
│   ├── mcp/
│   └── reporters/
│
├── integrations/
│   ├── github-action/
│   └── examples/
│
├── schemas/
│   ├── project-context.schema.json
│   ├── finding.schema.json
│   └── evidence.schema.json
│
├── docs/
│   ├── methodology.md
│   ├── rule-authoring.md
│   ├── limitations.md
│   └── legal-disclaimer.md
│
└── tests/
    ├── fixtures/
    ├── licenses/
    └── scenarios/
```

Python is a strong option for the policy/scanning core due to the available package ecosystem and ease of prototyping. TypeScript is attractive for an MCP/npm-first developer distribution. A pragmatic approach is either:

- TypeScript end-to-end for the first npm-focused version; or
- Python core + thin TypeScript MCP adapter.

The choice should minimize integration complexity rather than optimize prematurely.

---

# 23. Rules as Data

Avoid hard-coding every conclusion into application logic.

Example conceptual rule:

```yaml
id: AGPL_NETWORK_001
license:
  any:
    - AGPL-3.0-only
    - AGPL-3.0-or-later

when:
  network_access: true
  source_visibility: closed

outcome: red_flag

reason:
  short: >
    AGPL includes a network-interaction source availability condition
    that can conflict with a closed-source hosted model.

requires:
  - confirm_modification_status
  - confirm_component_boundary

references:
  - SPDX:AGPL-3.0-only
```

Benefits:

- auditable;
- testable;
- community-contributable;
- versionable;
- reviewable by lawyers/experts;
- decoupled from LLM behavior.

---

# 24. Testing Strategy

This product needs stronger testing than a normal developer utility because users will rely on its output.

## Unit tests
- SPDX parsing
- license expressions
- dependency graph paths
- rule conditions
- severity
- evidence aggregation
- assumption echoing

## Scenario tests

Example:

```text
Scenario:
Closed-source hosted SaaS
Dependency:
AGPL-3.0-only
Network access:
Yes
Expected:
red_flag
```

Another:

```text
Scenario:
Internal-only tool
Dependency:
GPL-3.0-only
No external distribution
Expected:
No automatic distribution conflict;
explain assumptions and monitor if distribution changes.
```

## Golden tests
Maintain expected reports for known repositories.

## Regression tests
Every corrected false positive/false negative becomes a permanent fixture.

## Expert review
Before claiming high reliability, have rule packs reviewed by qualified open-source licensing professionals.

---

# 25. Metrics That Matter

Avoid vanity metrics such as number of scanned packages.

Measure:

- repositories scanned;
- repeat weekly users;
- MCP calls per active repository;
- percentage of projects with saved context;
- number of findings investigated;
- number of “I didn’t know this” qualitative reports;
- number of dependency changes after a finding (strong signal, not the only signal);
- false-positive reports;
- unresolved-license rate;
- time from installation to first useful alert;
- conversion from local CLI → CI.

Primary open-source validation question:

> **Did builders learn about a material licensing red flag they would otherwise have missed?**

Secondary question:

> **Did that awareness change a shipping or dependency decision?**

Awareness alone can justify continuing an open-source advisor. Behavior change strengthens the case. “Nice report” with no attention shift is a kill signal.

---

# 26. Key Risks

## Risk 1 - “FOSSA/Snyk already does this”

**Response:** If the product becomes only a prettier scanner, this criticism is correct.

The differentiation must be:

- shipping-intent reasoning;
- builder-first alerts;
- MCP workflow;
- plain-language non-legal guidance;
- transparent policy-as-code;
- evidence + assumptions always visible.

## Risk 2 - Legal liability / false comfort

Mitigation:

- deterministic rules;
- conservative outcomes;
- explicit assumptions;
- evidence links;
- no “legal approval” language;
- escalation states;
- qualified expert review of rule packs;
- carefully written terms/disclaimers;
- prefer extra red flags over false Clear results.

## Risk 3 - Incorrect license metadata

Mitigation:

- multiple evidence sources;
- detect license files where possible;
- preserve conflicting evidence;
- version pinning;
- unresolved state.

## Risk 4 - LLM hallucination

Mitigation:

- LLM never creates the base finding;
- schema-constrained input/output;
- only explain structured findings;
- quote/cite source evidence;
- test explanations;
- keep the LLM a small fraction of the system.

## Risk 5 - Scope explosion

Mitigation:

- npm first;
- small, high-quality license family set;
- no SaaS dashboard initially;
- no alternatives engine;
- no attempt to replace Snyk/Socket security scanning;
- no premature monetization.

## Risk 6 - Weak willingness to act

Many builders who learn about a red flag still will not change a dependency until a client, investor, or buyer forces the issue.

**Response:** That does not kill an open-source advisor. It reframes success around awareness and pre-ship triage. It does warn against assuming easy paid conversion from individuals.

## Risk 7 - Wrong user intent produces wrong alerts

Mitigation:

- versioned context file;
- restate assumptions on every material finding;
- easy `context update`;
- `insufficient_context` outcomes when critical answers are missing.

---

# 27. What Would Make the Project “Shine”

The project becomes notable if it does these five things exceptionally well:

1. **One-command onboarding**
   ```bash
   npx license-advisor init
   ```

2. **MCP-first agent workflow**
   The coding agent can ask about licensing naturally while building or before shipping.

3. **Intent-aware alerts**
   The system knows whether the user is shipping SaaS, mobile, on-premise, SDK, internal tool, etc.

4. **Explainable evidence**
   Every alert can be traced to the dependency, license, rule and assumption.

5. **Calm triage instead of fear or false certainty**
   When something is problematic, the tool:
   - states the red flag;
   - shows why it matters under the user’s intent;
   - shows evidence;
   - states limits;
   - suggests human review when needed;
   - does **not** invent package replacements or legal verdicts.

That combination is substantially more compelling than “license scanner with AI summary.”

---

# 28. Product Personality

The product should behave like a calm senior engineer who understands software licensing, not like a lawyer writing a contract and not like an AI confidently improvising.

Good:

> “This deserves review before release. The project is configured as a closed-source SaaS, and dependency X is AGPL-3.0. The relevant issue is network interaction. Here is the path that introduced it.”

Bad:

> “You are legally forbidden from using this package.”

Bad:

> “You should really be more careful with open source.”

Bad:

> “License risk score: 74/100.”

Bad:

> “I recommend replacing this with Y.”

---

# 29. Execution Plan - Thin Prototype First

Because this should be validated cheaply, optimize for a narrow prototype before any “platform” timeline.

## Weeks 1 - 2 - Validation spine

- define project-context schema;
- define outcome taxonomy (`clear`, `notice`, `red_flag`, `insufficient_context`, `review_required`, `conflict`);
- select first 15 - 20 licenses;
- collect a handful of real repositories (own projects + public SaaS + AI-generated apps);
- manually define expected alerts;
- optionally recruit one open-source licensing expert for methodology review.

## Weeks 3 - 5 - Core engine

- npm dependency discovery from lockfiles;
- SPDX normalization;
- direct/transitive graph;
- rule-engine prototype for the highest-value scenarios;
- evidence + assumptions schema;
- CLI scan.

## Weeks 6 - 7 - MCP + explanation

- MCP server;
- `scan_project`;
- `check_dependency`;
- `explain_finding`;
- `update_project_context`;
- Cursor/Claude Code usage docs;
- schema-bound explanation layer.

## Week 8 - Reality check

- run against own repositories and selected public repos;
- measure whether alerts are actionable/surprising;
- fix false positives;
- decide go / reshape / stop.

Only after that reality check should CI polish, public launch packaging, or additional ecosystems be prioritized.

### Aspirational later work (not the initial commitment)

- GitHub Action / PR comments;
- PyPI support;
- broader rule packs;
- public beta launch assets;
- any hosted team features.

---

# 30. Validation Before Committing Heavily

Kill or validate the idea cheaply.

### Build a thin prototype that can:

1. inspect `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`;
2. normalize licenses;
3. ask ~5 context questions;
4. flag 5 - 10 important scenarios;
5. expose one or two MCP tools;
6. explain one dependency path with evidence and assumptions.

Then run it against:

- your own projects;
- five public SaaS repositories;
- five AI-generated demo projects.

### Continue if:

- output repeatedly surfaces facts the project owner did not know;
- builders describe the alerts as useful, calm and credible;
- people are willing to save a project-context file and re-run.

### Stop or reposition if:

- users only say “nice report”;
- alerts feel obvious, noisy or untrustworthy;
- the tool needs alternatives/auto-fix narratives to feel valuable;
- maintaining license truthiness is too expensive for the value returned.

---

# 31. Suggested Product Names - Direction Only

A final name should be checked for trademark, domains and package availability.

Directions:

- **LicenseLens**
- **ShipSure**
- **DepRights**
- **OpenScope**
- **LicensePath**
- **ShipPolicy**
- **OSS Compass**
- **Permit**
- **ShipCheck**
- **OpenGuard**
- **Licensable**

Avoid names that imply legal counsel or guaranteed approval.

The strongest brand message is probably around **shipping knowingly / seeing red flags early**, rather than “legal compliance” or “AI lawyer.”

---

# 32. Example MCP Conversation

**User**

> I’m building a paid SaaS for third parties. Check whether anything in this project looks like a licensing red flag.

**Agent → MCP**

```json
{
  "tool": "scan_project",
  "context": {
    "business_model": "paid_saas",
    "audience": "third_parties",
    "source_visibility": "closed",
    "distribution": "hosted",
    "network_access": true
  }
}
```

**Tool result**

```json
{
  "summary": {
    "dependencies": 487,
    "clear": 463,
    "notice": 18,
    "red_flag": 5,
    "review_required": 1,
    "insufficient_context": 0,
    "conflict": 0
  },
  "highest_priority": [
    {
      "package": "example-package",
      "version": "2.1.0",
      "license": "AGPL-3.0-only",
      "dependency_path": [
        "app",
        "framework-plugin",
        "example-package"
      ],
      "rule": "AGPL_NETWORK_001",
      "outcome": "red_flag",
      "assumptions": [
        "closed_source",
        "network_accessible_service",
        "no_customer_distribution"
      ]
    }
  ]
}
```

**Agent explanation**

> Under your stated plan - paid closed-source SaaS for third parties - I found one dependency that deserves attention before you commercialize. It is not directly installed; it arrives through `framework-plugin`. The package is licensed under AGPL-3.0. The issue is the network-interaction condition, which can matter for hosted closed-source services. This is a red flag for review, not a legal verdict. I can show the evidence, the dependency path, or help you update the project context if your architecture assumptions are different.

This is the experience the product should own.

---

# 33. Assessment of the Opportunity

### Is there a real problem?
**Yes.** License compliance is already a serious category precisely because software depends heavily on third-party code. AI-assisted building widens the awareness gap.

### Is the scanner itself novel?
**No.** Mature tooling already exists.

### Is an intent-aware licensing advisor differentiated enough to test?
**Yes - as an experience and packaging bet, especially for AI-native builders.**

### Is MCP alone the innovation?
**No.** MCP is an interface. Socket already validates that dependency intelligence belongs inside AI-assisted development.

### Is an alternatives engine part of the bet?
**No.** It is attractive, fragile, and deferred.

### What is the actual innovation?
The combination of:

- software usage/commercialization intent as first-class input;
- deterministic licensing policy;
- calm conversational alerts;
- agent-native integration;
- traceable evidence and explicit assumptions;
- low-friction onboarding for the new generation of software builders;
- refusal to sentence, score-wash, or overclaim.

### Should this start as SaaS?
**No.** Start as an open-source local tool with CLI + MCP.

### Should this start with pricing?
**No.** Validate usefulness and trust first.

### Can it become commercial later?
**Maybe, only if real usage creates a team/governance pain.** That is optional and currently unproven.

### Is it worth the founder/developer time?
**Worth a focused prototype, not yet worth a multi-month platform build.**

The right decision is to invest a small number of focused weeks into a narrow, polished prototype and validate whether builders repeatedly discover actionable license red flags they did not know they had.

If that happens, continue.

If users only say “nice report” and do not pay attention differently, stop or reposition.

---

# 34. Immediate Next Steps

1. Choose a temporary project name.
2. Write the `project-context` schema.
3. Define the first 15 - 20 supported license families.
4. Define the first deterministic rule matrix and outcome taxonomy.
5. Start npm-only for v0.
6. Build CLI scan output with evidence + assumptions.
7. Wrap the core with MCP.
8. Test against real repositories.
9. Get methodology reviewed by an open-source licensing expert when the rule pack stabilizes.
10. Publish a technical demo only after the thin prototype proves useful - still without a SaaS layer or alternatives engine.

---

# 35. Sources and Market References

The market section above is based on product documentation and public materials available in September 2026.

- FOSSA CLI documentation: https://docs.fossa.com/docs/cli
- FOSSA first-party license scanning: https://docs.fossa.com/docs/cli/features/first-party-license-scans
- OSS Review Toolkit - main documentation: https://oss-review-toolkit.org/
- ORT evaluator rules: https://oss-review-toolkit.org/ort/docs/configuration/evaluator-rules
- ORT license classifications: https://oss-review-toolkit.org/ort/docs/configuration/license-classifications
- ORT license handling: https://oss-review-toolkit.org/ort/docs/guides/license-handling
- ScanCode Toolkit: https://github.com/aboutcode-org/scancode-toolkit
- Sonatype license compliance: https://www.sonatype.com/solutions/legal-open-source-license-compliance
- Mend open-source license compliance: https://www.mend.io/open-source-license-compliance/
- Socket MCP documentation: https://docs.socket.dev/docs/guide-to-socket-mcp
- Socket MCP announcement/context: https://socket.dev/blog/socket-mcp
- SPDX License List: https://spdx.org/licenses/
- Open Source Initiative licenses: https://opensource.org/licenses

---

# 36. Final Product Principle

The product should not promise:

> **“We know the law for you.”**

It should not promise:

> **“We will find a compatible package for you.”**

It should not promise:

> **“This score means you are safe to ship.”**

It should promise:

> **“Tell us how you intend to ship. We’ll make the licensing implications of your dependencies visible, understandable, traceable and alert-worthy - without pretending to be your lawyer.”**

That is both more credible and, as a product, more useful.
