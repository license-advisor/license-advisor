#!/usr/bin/env node

import { resolve } from "node:path";
import {
  buildDefaultContext,
  loadProjectContext,
  resolveContextPath,
  writeProjectContext,
} from "./context.js";
import {
  loadDependencyGraph,
  type DependencyGraph,
  type DependencyNode,
} from "./graph/index.js";
import {
  loadLicenseScan,
  type LicenseResolution,
  type LicenseScanResult,
} from "./licenses/index.js";
import { runInteractiveCli } from "./interactive.js";
import {
  printScanHuman,
  runScan,
  toScanJson,
  toScanMarkdown,
} from "./policy/index.js";
import {
  DEFAULT_CONTEXT_FILENAME,
  OUTCOME_HELP,
  OUTCOMES,
  type ProjectContext,
} from "./types.js";

function printUsage(): void {
  console.log(`license-advisor: licensing advisor (pre-MVP)

Interactive (recommended):
  license-advisor
  license-advisor interactive

Commands:
  license-advisor init [--name <name>] [--force] [--path <file>]
  license-advisor context show [--path <file>]
  license-advisor context validate [--path <file>]
  license-advisor deps summary [--lockfile <file>]
  license-advisor deps list [--direct|--transitive] [--lockfile <file>] [--json]
  license-advisor deps why <package> [--lockfile <file>]
  license-advisor licenses summary [--lockfile <file>]
  license-advisor licenses list [--status <status>] [--lockfile <file>] [--json]
  license-advisor licenses show <package> [--lockfile <file>]
  license-advisor scan [--path <context>] [--lockfile <file>] [--json|--markdown] [--draft]
  license-advisor mcp
  license-advisor outcomes
  license-advisor help

Notes:
  - Run with no arguments to open the guided terminal wizard.
  - Ecosystems: npm, pnpm, Yarn classic (v1), PyPI (requirements+.venv / poetry / uv).
  - Scan evaluates deterministic rules against project-context (alerts, not legal advice).
  - Exit code 1 when fail_on outcomes are present (default: conflict).
`);
}

function printOutcomes(): void {
  console.log("Outcome taxonomy\n");
  for (const outcome of OUTCOMES) {
    console.log(`  ${outcome.padEnd(22)} ${OUTCOME_HELP[outcome]}`);
  }
  console.log(`
Rules:
  - Prefer false caution over false comfort.
  - Always echo assumptions on notice / red_flag / review_required / conflict.
  - clear means "clear under stated assumptions", not "approved".
`);
}

function printContextSummary(context: ProjectContext, path: string): void {
  const { project, policy, meta } = context;

  console.log(`Project context: ${path}`);
  console.log(`Schema:          ${context.schema_version}`);
  if (meta?.notes) {
    console.log(`Notes:           ${meta.notes}`);
  }
  console.log("");
  console.log("Shipping intent");
  console.log(`  name:                    ${project.name ?? "(none)"}`);
  console.log(`  delivery:                ${project.delivery}`);
  console.log(`  commercial:              ${project.commercial}`);
  console.log(`  audience:                ${project.audience ?? "(unset)"}`);
  console.log(`  source_visibility:       ${project.source_visibility}`);
  console.log(`  customer_distribution:   ${project.customer_distribution}`);
  console.log(`  network_access:          ${project.network_access}`);
  console.log(
    `  modifies_dependencies:   ${project.modifies_dependencies ?? "(unset)"}`,
  );
  console.log(`  linking_model:           ${project.linking_model ?? "(unset)"}`);
  console.log(
    `  target_platforms:        ${(project.target_platforms ?? []).join(", ") || "(none)"}`,
  );
  console.log(
    `  scopes_in_scope:         ${(project.dependency_scopes_in_scope ?? ["production"]).join(", ")}`,
  );
  console.log("");
  console.log("Local policy");
  console.log(`  fail_on:  ${(policy?.fail_on ?? ["conflict"]).join(", ")}`);
  console.log(
    `  warn_on:  ${(policy?.warn_on ?? ["red_flag", "review_required"]).join(", ")}`,
  );
  console.log("");
  console.log(
    "Reminder: wrong intent produces wrong alerts. Update this file when your shipping plan changes.",
  );
}

function printDepsSummary(graph: DependencyGraph): void {
  const lockLabel =
    graph.packageManager === "pypi"
      ? "pypi"
      : `${graph.packageManager} (lock v${graph.lockfileVersion})`;

  console.log(`Dependency graph: ${graph.lockfilePath}`);
  console.log(`Root:             ${graph.rootName}@${graph.rootVersion}`);
  console.log(`Ecosystem:        ${lockLabel}`);
  console.log("");
  console.log("Stats");
  console.log(`  total:              ${graph.stats.total}`);
  console.log(`  direct:             ${graph.stats.direct}`);
  console.log(`  transitive:         ${graph.stats.transitive}`);
  console.log(`  production scope:   ${graph.stats.production}`);
  console.log(`  development scope:  ${graph.stats.development}`);
  console.log(
    `  license field set:   ${graph.stats.withLicenseField}/${graph.stats.total}`,
  );
  console.log("");
  console.log(
    "Note: declared license fields are opportunistic. Full SPDX resolution uses package metadata + LICENSE evidence.",
  );
}

function formatNodeLine(node: DependencyNode): string {
  const scopes = node.scopes.join("+");
  const license = node.license ? ` license=${node.license}` : "";
  return `${node.relationship.padEnd(11)} ${node.name}@${node.version}  [${scopes}]${license}`;
}

function printDepsList(
  graph: DependencyGraph,
  {
    directOnly,
    transitiveOnly,
    asJson,
  }: { directOnly: boolean; transitiveOnly: boolean; asJson: boolean },
): void {
  let nodes = graph.nodes;
  if (directOnly) nodes = nodes.filter((n) => n.relationship === "direct");
  if (transitiveOnly) {
    nodes = nodes.filter((n) => n.relationship === "transitive");
  }

  if (asJson) {
    console.log(JSON.stringify({ root: graph.rootName, nodes }, null, 2));
    return;
  }

  console.log(
    `Dependencies (${nodes.length}) - ${directOnly ? "direct" : transitiveOnly ? "transitive" : "all"}\n`,
  );
  for (const node of nodes) {
    console.log(`  ${formatNodeLine(node)}`);
  }
}

function printDepsWhy(graph: DependencyGraph, packageName: string): number {
  const matches = graph.nodes.filter(
    (n) => n.name === packageName || n.name.endsWith(`/${packageName}`),
  );

  if (matches.length === 0) {
    console.error(`Package not found in graph: ${packageName}`);
    return 1;
  }

  for (const node of matches) {
    console.log(`${node.name}@${node.version}`);
    console.log(`  relationship: ${node.relationship}`);
    console.log(`  scopes:       ${node.scopes.join(", ")}`);
    console.log(`  path:         ${node.path.join(" → ")}`);
    console.log(
      `  introducedBy: ${node.introducedBy.length > 0 ? node.introducedBy.join(", ") : "(root)"}`,
    );
    if (node.license) console.log(`  license:      ${node.license}`);
    console.log("");
  }
  return 0;
}

function printLicensesSummary(scan: LicenseScanResult): void {
  console.log(`License scan: ${scan.lockfilePath}`);
  console.log(`Root:         ${scan.rootName}`);
  console.log("");
  console.log("Stats");
  console.log(`  total:         ${scan.stats.total}`);
  console.log(`  resolved:      ${scan.stats.resolved}`);
  console.log(`  unresolved:    ${scan.stats.unresolved}`);
  console.log(`  conflicting:   ${scan.stats.conflicting}`);
  console.log(`  expression:    ${scan.stats.expression}`);
  console.log("");
  console.log(
    "Note: resolved ≠ approved. Policy evaluation against project-context comes next.",
  );
}

function formatLicenseLine(item: LicenseResolution): string {
  const concluded = item.concluded ?? "(none)";
  return `${item.status.padEnd(12)} ${item.packageName}@${item.version}  concluded=${concluded}`;
}

function printLicensesList(
  scan: LicenseScanResult,
  {
    statusFilter,
    asJson,
  }: { statusFilter?: string; asJson: boolean },
): void {
  let items = scan.resolutions;
  if (statusFilter) {
    items = items.filter((r) => r.status === statusFilter);
  }

  if (asJson) {
    console.log(JSON.stringify({ root: scan.rootName, resolutions: items }, null, 2));
    return;
  }

  console.log(
    `Licenses (${items.length})${statusFilter ? ` - status=${statusFilter}` : ""}\n`,
  );
  for (const item of items) {
    console.log(`  ${formatLicenseLine(item)}`);
  }
}

function printLicenseShow(
  scan: LicenseScanResult,
  packageName: string,
): number {
  const matches = scan.resolutions.filter(
    (r) =>
      r.packageName === packageName ||
      r.packageName.endsWith(`/${packageName}`),
  );

  if (matches.length === 0) {
    console.error(`Package not found in license scan: ${packageName}`);
    return 1;
  }

  for (const item of matches) {
    console.log(`${item.packageName}@${item.version}`);
    console.log(`  status:     ${item.status}`);
    console.log(`  concluded:  ${item.concluded ?? "(none)"}`);
    console.log(
      `  spdxIds:    ${item.spdxIds.length > 0 ? item.spdxIds.join(", ") : "(none)"}`,
    );
    console.log("  evidence:");
    for (const ev of item.evidence) {
      console.log(
        `    - [${ev.type}] ${ev.value} → ${ev.normalized ?? "(unnormalized)"} (confidence=${ev.confidence})`,
      );
      if (ev.path) console.log(`      source: ${ev.path}`);
    }
    if (item.notes.length > 0) {
      console.log("  notes:");
      for (const note of item.notes) console.log(`    - ${note}`);
    }
    console.log("");
  }
  return 0;
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const flags = new Map<string, string | boolean>();
  const positional: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        flags.set(key, true);
      } else {
        flags.set(key, next);
        i += 1;
      }
    } else {
      positional.push(token);
    }
  }

  return { positional, flags };
}

function getStringFlag(
  flags: Map<string, string | boolean>,
  name: string,
): string | undefined {
  const value = flags.get(name);
  return typeof value === "string" ? value : undefined;
}

async function main(): Promise<number> {
  const { positional, flags } = parseArgs(process.argv);
  const [command, subcommand, arg0] = positional;

  if (!command || command === "interactive" || command === "i") {
    return runInteractiveCli(process.cwd());
  }

  if (command === "help" || flags.get("help")) {
    printUsage();
    return 0;
  }

  if (command === "outcomes") {
    printOutcomes();
    return 0;
  }

  if (command === "init") {
    const cwd = process.cwd();
    const explicit = getStringFlag(flags, "path");
    const target = resolveContextPath(cwd, explicit);
    const name = getStringFlag(flags, "name");
    const force = Boolean(flags.get("force"));

    try {
      const context = buildDefaultContext(name);
      writeProjectContext(target, context, { force });
      console.log(`Wrote ${target}`);
      console.log(
        "Edit shipping intent before scanning. This file drives every alert.",
      );
      return 0;
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      return 1;
    }
  }

  if (command === "context") {
    const cwd = process.cwd();
    const explicit = getStringFlag(flags, "path");

    if (subcommand === "show" || subcommand === "validate") {
      try {
        const result = loadProjectContext(cwd, explicit);
        if (!result.ok) {
          console.error(`Invalid project context: ${result.path}`);
          for (const err of result.errors) {
            console.error(`  - ${err}`);
          }
          return 1;
        }

        if (subcommand === "validate") {
          console.log(`Valid project context: ${result.path}`);
          return 0;
        }

        printContextSummary(result.context, result.path);
        return 0;
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        return 1;
      }
    }

    console.error(`Unknown context subcommand: ${subcommand ?? "(missing)"}`);
    console.error("Use: context show | context validate");
    return 1;
  }

  if (command === "deps") {
    try {
      const lockfile = getStringFlag(flags, "lockfile");
      const graph = loadDependencyGraph(process.cwd(), lockfile);

      if (subcommand === "summary" || !subcommand) {
        printDepsSummary(graph);
        return 0;
      }

      if (subcommand === "list") {
        printDepsList(graph, {
          directOnly: Boolean(flags.get("direct")),
          transitiveOnly: Boolean(flags.get("transitive")),
          asJson: Boolean(flags.get("json")),
        });
        return 0;
      }

      if (subcommand === "why") {
        if (!arg0) {
          console.error("Usage: deps why <package>");
          return 1;
        }
        return printDepsWhy(graph, arg0);
      }

      console.error(`Unknown deps subcommand: ${subcommand}`);
      console.error("Use: deps summary | deps list | deps why <package>");
      return 1;
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      return 1;
    }
  }

  if (command === "licenses") {
    try {
      const lockfile = getStringFlag(flags, "lockfile");
      const { licenses } = loadLicenseScan(process.cwd(), lockfile);

      if (subcommand === "summary" || !subcommand) {
        printLicensesSummary(licenses);
        return 0;
      }

      if (subcommand === "list") {
        printLicensesList(licenses, {
          statusFilter: getStringFlag(flags, "status"),
          asJson: Boolean(flags.get("json")),
        });
        return 0;
      }

      if (subcommand === "show") {
        if (!arg0) {
          console.error("Usage: licenses show <package>");
          return 1;
        }
        return printLicenseShow(licenses, arg0);
      }

      console.error(`Unknown licenses subcommand: ${subcommand}`);
      console.error(
        "Use: licenses summary | licenses list | licenses show <package>",
      );
      return 1;
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      return 1;
    }
  }

  if (command === "scan") {
    try {
      const result = runScan({
        cwd: process.cwd(),
        contextPath: getStringFlag(flags, "path"),
        lockfilePath: getStringFlag(flags, "lockfile"),
        includeDraft: Boolean(flags.get("draft")),
      });

      if (flags.get("json")) {
        console.log(toScanJson(result));
      } else if (flags.get("markdown")) {
        console.log(toScanMarkdown(result));
      } else {
        printScanHuman(result);
      }

      return result.exitHint.shouldFail ? 1 : 0;
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      return 1;
    }
  }

  if (command === "mcp") {
    // Starts the stdio MCP server (same entry as license-advisor-mcp).
    await import("./mcp/server.js");
    // Keep process alive; server owns the connection.
    return await new Promise<number>(() => {
      /* never resolves */
    });
  }

  if (command === "validate") {
    const file = positional[1]
      ? resolve(process.cwd(), positional[1])
      : undefined;
    try {
      const result = loadProjectContext(
        process.cwd(),
        file ?? getStringFlag(flags, "path") ?? DEFAULT_CONTEXT_FILENAME,
      );
      if (!result.ok) {
        console.error(`Invalid project context: ${result.path}`);
        for (const err of result.errors) {
          console.error(`  - ${err}`);
        }
        return 1;
      }
      console.log(`Valid project context: ${result.path}`);
      return 0;
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      return 1;
    }
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  return 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
