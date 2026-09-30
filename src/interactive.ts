import * as p from "@clack/prompts";
import color from "picocolors";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildDefaultContext,
  loadProjectContext,
  resolveContextPath,
  writeProjectContext,
} from "./context.js";
import { findAnyManifest, loadDependencyGraph } from "./graph/index.js";
import { explainFindingText } from "./mcp/explain.js";
import { printScanHuman, runScan } from "./policy/index.js";
import type { EngineFinding, PolicyScanResult } from "./policy/types.js";
import {
  AUDIENCE_OPTIONS,
  COMMERCIAL_OPTIONS,
  CUSTOMER_DISTRIBUTION,
  DEFAULT_CONTEXT_FILENAME,
  DELIVERY_MODES,
  LINKING_MODELS,
  MODIFIES_DEPENDENCIES,
  OUTCOME_HELP,
  OUTCOMES,
  SOURCE_VISIBILITY,
  type AudienceOption,
  type CommercialOption,
  type CustomerDistribution,
  type DeliveryMode,
  type LinkingModel,
  type ModifiesDependencies,
  type ProjectContext,
  type SourceVisibility,
} from "./types.js";

function onCancel(): never {
  p.cancel("Stopped. No problem.");
  process.exit(0);
}

function ensureNotCancel<T>(value: T): Exclude<T, symbol> {
  if (p.isCancel(value)) onCancel();
  return value as Exclude<T, symbol>;
}

const DELIVERY_LABELS: Record<DeliveryMode, string> = {
  hosted_saas: "Hosted SaaS",
  mobile_app: "Mobile app",
  desktop_app: "Desktop app",
  on_premise: "On-premise deployment",
  library_sdk: "Library / SDK",
  cli_tool: "CLI tool",
  internal_only: "Internal-only",
  client_deliverable: "Client deliverable / agency project",
  embedded_firmware: "Embedded / firmware",
  open_source_project: "Open-source project",
  other: "Other",
};

const COMMERCIAL_LABELS: Record<CommercialOption, string> = {
  yes: "Yes",
  no: "No",
  undecided: "Not decided yet",
};

const SOURCE_LABELS: Record<SourceVisibility, string> = {
  closed: "Closed source",
  source_available: "Source available",
  open: "Open source",
  undecided: "Not decided yet",
};

const DISTRIBUTION_LABELS: Record<CustomerDistribution, string> = {
  none: "No (customers do not receive binaries/source)",
  binaries: "Yes, binaries/executables",
  source: "Yes, source code",
  binaries_and_source: "Yes, binaries and source",
  some_components: "Some components only",
  unknown: "Unknown / not sure",
};

const AUDIENCE_LABELS: Record<AudienceOption, string> = {
  self: "Just me",
  internal_team: "Internal team",
  third_parties: "Third parties / customers",
  public: "Public users",
  mixed: "Mixed",
  unknown: "Unknown / not sure",
};

const MODIFIES_LABELS: Record<ModifiesDependencies, string> = {
  yes: "Yes",
  no: "No",
  unknown: "Unknown / not sure",
};

const LINKING_LABELS: Record<LinkingModel, string> = {
  unknown: "Unknown / not sure",
  separate_process: "Separate process / service",
  dynamic_link: "Dynamically linked",
  static_link: "Statically linked",
  source_incorporation: "Source incorporated",
  mixed: "Mixed",
};

async function configureProjectContext(cwd: string): Promise<string> {
  p.note(
    "Wrong shipping intent produces wrong alerts.\nAnswer for how you plan to ship, not how the code feels today.",
    "Project intent",
  );

  const existingPath = resolveContextPath(cwd);
  const existing = existsSync(existingPath)
    ? loadProjectContext(cwd)
    : null;

  if (existing && existing.ok) {
    const reuse = ensureNotCancel(
      await p.confirm({
        message: `Found ${DEFAULT_CONTEXT_FILENAME}. Reconfigure it?`,
        initialValue: true,
      }),
    );
    if (!reuse) {
      p.log.info(`Keeping ${existingPath}`);
      return existingPath;
    }
  }

  const name = ensureNotCancel(
    await p.text({
      message: "Project name",
      initialValue:
        (existing && existing.ok && existing.context.project.name) ||
        "my-app",
    }),
  );

  const delivery = ensureNotCancel(
    await p.select({
      message: "How will this software be delivered?",
      options: DELIVERY_MODES.map((value) => ({
        value,
        label: DELIVERY_LABELS[value],
      })),
      initialValue:
        (existing && existing.ok && existing.context.project.delivery) ||
        "hosted_saas",
    }),
  );

  const commercial = ensureNotCancel(
    await p.select({
      message: "Is it commercial?",
      options: COMMERCIAL_OPTIONS.map((value) => ({
        value,
        label: COMMERCIAL_LABELS[value],
      })),
      initialValue:
        (existing && existing.ok && existing.context.project.commercial) ||
        "undecided",
    }),
  );

  const audience = ensureNotCancel(
    await p.select({
      message: "Who primarily uses or receives it?",
      options: AUDIENCE_OPTIONS.map((value) => ({
        value,
        label: AUDIENCE_LABELS[value],
      })),
      initialValue:
        (existing && existing.ok && existing.context.project.audience) ||
        "unknown",
    }),
  );

  const sourceVisibility = ensureNotCancel(
    await p.select({
      message: "Is your own project intended to remain closed-source?",
      options: SOURCE_VISIBILITY.map((value) => ({
        value,
        label: SOURCE_LABELS[value],
      })),
      initialValue:
        (existing &&
          existing.ok &&
          existing.context.project.source_visibility) ||
        "undecided",
    }),
  );

  const customerDistribution = ensureNotCancel(
    await p.select({
      message: "Will customers/third parties receive executable or source code?",
      options: CUSTOMER_DISTRIBUTION.map((value) => ({
        value,
        label: DISTRIBUTION_LABELS[value],
      })),
      initialValue:
        (existing &&
          existing.ok &&
          existing.context.project.customer_distribution) ||
        "unknown",
    }),
  );

  const networkAccess = ensureNotCancel(
    await p.confirm({
      message: "Will users interact with the software over a network?",
      initialValue:
        (existing && existing.ok && existing.context.project.network_access) ??
        true,
    }),
  );

  const modifiesDependencies = ensureNotCancel(
    await p.select({
      message: "Do you modify any open-source dependencies?",
      options: MODIFIES_DEPENDENCIES.map((value) => ({
        value,
        label: MODIFIES_LABELS[value],
      })),
      initialValue:
        (existing &&
          existing.ok &&
          existing.context.project.modifies_dependencies) ||
        "unknown",
    }),
  );

  const linkingModel = ensureNotCancel(
    await p.select({
      message: "How are dependencies typically combined with your app?",
      options: LINKING_MODELS.map((value) => ({
        value,
        label: LINKING_LABELS[value],
      })),
      initialValue:
        (existing && existing.ok && existing.context.project.linking_model) ||
        "unknown",
    }),
  );

  const now = new Date().toISOString();
  const context: ProjectContext = {
    schema_version: "0.1.0",
    meta: {
      created_at:
        (existing && existing.ok && existing.context.meta?.created_at) || now,
      updated_at: now,
      notes:
        "Configured via interactive CLI. Wrong intent produces wrong alerts.",
    },
    project: {
      name: String(name),
      delivery,
      commercial,
      audience,
      source_visibility: sourceVisibility,
      customer_distribution: customerDistribution,
      network_access: networkAccess,
      modifies_dependencies: modifiesDependencies,
      linking_model: linkingModel,
      target_platforms: ["web"],
      dependency_scopes_in_scope: ["production"],
    },
    policy: {
      fail_on: ["conflict"],
      warn_on: ["red_flag", "review_required"],
    },
  };

  const target = resolveContextPath(cwd);
  writeProjectContext(target, context, { force: true });
  p.log.success(`Wrote ${target}`);
  return target;
}

function printFindingBrief(finding: EngineFinding): void {
  p.log.message(
    `${color.bold(`[${finding.outcome}]`)} ${finding.dependency.name}@${finding.dependency.version}\n` +
      `  rule: ${finding.rule_id}\n` +
      `  path: ${finding.dependency.dependency_path.join(" -> ")}\n` +
      `  why:  ${finding.reason.short}`,
  );
}

async function explainFindingsInteractively(
  findings: EngineFinding[],
): Promise<void> {
  if (findings.length === 0) {
    p.log.info("No findings to explain.");
    return;
  }

  const selected = ensureNotCancel(
    await p.select({
      message: "Which finding do you want explained?",
      options: findings.map((finding) => ({
        value: finding.finding_id,
        label: `[${finding.outcome}] ${finding.dependency.name}@${finding.dependency.version}`,
        hint: finding.rule_id,
      })),
    }),
  );

  const finding = findings.find((item) => item.finding_id === selected);
  if (!finding) return;

  p.note(explainFindingText(finding), "Finding explanation");
}

async function inspectDependency(cwd: string): Promise<void> {
  const manifest = findAnyManifest(cwd);
  if (!manifest) {
    p.log.error(
      "No supported manifest found (package-lock.json, pnpm-lock.yaml, yarn.lock, poetry.lock, uv.lock, or requirements.txt + .venv).",
    );
    return;
  }

  const packageName = String(
    ensureNotCancel(
      await p.text({
        message: "Package name to inspect",
        placeholder: "e.g. express or requests",
        validate(value) {
          if (!value || !String(value).trim()) return "Package name is required.";
        },
      }),
    ),
  ).trim();

  const graph = loadDependencyGraph(cwd);
  const matches = graph.nodes.filter(
    (node) =>
      node.name === packageName || node.name.endsWith(`/${packageName}`),
  );

  if (matches.length === 0) {
    p.log.error(`Package not found: ${packageName}`);
    return;
  }

  for (const node of matches) {
    p.note(
      [
        `${node.name}@${node.version}`,
        `relationship: ${node.relationship}`,
        `scopes: ${node.scopes.join(", ")}`,
        `path: ${node.path.join(" -> ")}`,
        `introducedBy: ${node.introducedBy.length > 0 ? node.introducedBy.join(", ") : "(root)"}`,
        node.license ? `license field: ${node.license}` : "license field: (none)",
      ].join("\n"),
      "Dependency",
    );
  }
}

async function showOutcomesHelp(): Promise<void> {
  const lines = OUTCOMES.map(
    (outcome) => `${outcome.padEnd(22)} ${OUTCOME_HELP[outcome]}`,
  );
  p.note(
    `${lines.join("\n")}\n\nReminder: clear means clear under stated assumptions, not legal approval.`,
    "Outcome taxonomy",
  );
}

async function runInteractiveScan(cwd: string): Promise<void> {
  const contextPath = resolveContextPath(cwd);
  if (!existsSync(contextPath)) {
    const create = ensureNotCancel(
      await p.confirm({
        message: "No project-context.yaml found. Configure it now?",
        initialValue: true,
      }),
    );
    if (!create) {
      p.log.warn("Scan needs project intent first.");
      return;
    }
    await configureProjectContext(cwd);
  }

  const manifest = findAnyManifest(cwd);
  if (!manifest) {
    p.log.error(
      "No supported dependency manifest found. Need package-lock.json, pnpm-lock.yaml, yarn.lock (v1), poetry.lock / uv.lock, or requirements.txt with a local .venv/venv.",
    );
    return;
  }

  const spinner = p.spinner();
  spinner.start("Scanning dependencies against your shipping intent");
  let result: PolicyScanResult;
  try {
    result = runScan({
      cwd,
      contextPath,
    });
    spinner.stop("Scan complete");
  } catch (error) {
    spinner.stop("Scan failed");
    p.log.error(error instanceof Error ? error.message : String(error));
    return;
  }

  console.log("");
  printScanHuman(result);
  console.log("");

  if (result.highestPriority.length > 0) {
    p.log.step("Highest priority findings");
    for (const finding of result.highestPriority.slice(0, 5)) {
      printFindingBrief(finding);
    }
  }

  let continueLoop = true;
  while (continueLoop) {
    const next = ensureNotCancel(
      await p.select({
        message: "What next?",
        options: [
          {
            value: "explain",
            label: "Explain a finding",
            hint: "evidence + assumptions",
          },
          {
            value: "inspect",
            label: "Inspect a dependency path",
          },
          {
            value: "reconfigure",
            label: "Update project intent and re-scan",
          },
          {
            value: "rescan",
            label: "Re-scan with current context",
          },
          {
            value: "done",
            label: "Done",
          },
        ],
      }),
    );

    if (next === "explain") {
      await explainFindingsInteractively(result.findings);
    } else if (next === "inspect") {
      await inspectDependency(cwd);
    } else if (next === "reconfigure") {
      await configureProjectContext(cwd);
      await runInteractiveScan(cwd);
      return;
    } else if (next === "rescan") {
      await runInteractiveScan(cwd);
      return;
    } else {
      continueLoop = false;
    }
  }
}

async function showCurrentContext(cwd: string): Promise<void> {
  const result = loadProjectContext(cwd);
  if (!result.ok) {
    p.log.error(`No valid project context at ${result.path}`);
    for (const err of result.errors) p.log.message(`- ${err}`);
    const create = ensureNotCancel(
      await p.confirm({
        message: "Configure one now?",
        initialValue: true,
      }),
    );
    if (create) await configureProjectContext(cwd);
    return;
  }

  const project = result.context.project;
  p.note(
    [
      `file: ${result.path}`,
      `name: ${project.name ?? "(none)"}`,
      `delivery: ${project.delivery}`,
      `commercial: ${project.commercial}`,
      `audience: ${project.audience ?? "(unset)"}`,
      `source_visibility: ${project.source_visibility}`,
      `customer_distribution: ${project.customer_distribution}`,
      `network_access: ${String(project.network_access)}`,
      `modifies_dependencies: ${project.modifies_dependencies ?? "(unset)"}`,
      `linking_model: ${project.linking_model ?? "(unset)"}`,
    ].join("\n"),
    "Current project intent",
  );
}

export async function runInteractiveCli(
  cwd = process.cwd(),
): Promise<number> {
  console.log("");
  p.intro(color.bgCyan(color.black(" License Advisor ")));
  p.log.message(
    "Alert on dependency license implications for how you plan to ship.\nNot legal advice. The engine alerts; it does not sentence.",
  );

  let running = true;
  while (running) {
    const action = ensureNotCancel(
      await p.select({
        message: "What do you want to do?",
        options: [
          {
            value: "configure",
            label: "Configure project intent",
            hint: "create/update project-context.yaml",
          },
          {
            value: "scan",
            label: "Scan this project",
            hint: "npm/pnpm/yarn/PyPI + intent + rules",
          },
          {
            value: "context",
            label: "Show current project intent",
          },
          {
            value: "inspect",
            label: "Inspect a dependency",
          },
          {
            value: "outcomes",
            label: "Explain outcome labels",
          },
          {
            value: "exit",
            label: "Exit",
          },
        ],
      }),
    );

    if (action === "configure") {
      const path = await configureProjectContext(cwd);
      const scanNow = ensureNotCancel(
        await p.confirm({
          message: "Run scan now?",
          initialValue: true,
        }),
      );
      if (scanNow) {
        p.log.info(`Using ${path}`);
        await runInteractiveScan(cwd);
      }
    } else if (action === "scan") {
      await runInteractiveScan(cwd);
    } else if (action === "context") {
      await showCurrentContext(cwd);
    } else if (action === "inspect") {
      await inspectDependency(cwd);
    } else if (action === "outcomes") {
      await showOutcomesHelp();
    } else {
      running = false;
    }
  }

  p.outro("Done. Re-run anytime with: npm run dev");
  return 0;
}

/** Non-interactive helper kept for tests/docs. */
export function defaultContextTemplate(name?: string): ProjectContext {
  return buildDefaultContext(name);
}

export function resolveInteractiveCwd(explicit?: string): string {
  return explicit ? resolve(explicit) : process.cwd();
}
