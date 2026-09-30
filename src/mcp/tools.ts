import { resolve } from "node:path";
import { z } from "zod";
import {
  buildDefaultContext,
  loadProjectContext,
  patchProjectContext,
  resolveContextPath,
  writeProjectContext,
} from "../context.js";
import { loadDependencyGraph } from "../graph/index.js";
import { loadLicenseScan } from "../licenses/index.js";
import { runScan } from "../policy/index.js";
import {
  COMMERCIAL_OPTIONS,
  CUSTOMER_DISTRIBUTION,
  DELIVERY_MODES,
  LINKING_MODELS,
  MODIFIES_DEPENDENCIES,
  SOURCE_VISIBILITY,
} from "../types.js";
import { explainFindingText, explainScanOverview } from "./explain.js";

function resolveRoot(projectRoot?: string): string {
  return resolve(projectRoot ?? process.env.LICENSE_ADVISOR_ROOT ?? process.cwd());
}

function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(message: string) {
  return {
    isError: true as const,
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
  };
}

export const projectRootSchema = {
  project_root: z
    .string()
    .optional()
    .describe(
      "Absolute path to the target project. Defaults to LICENSE_ADVISOR_ROOT or process cwd.",
    ),
};

export async function handleScanProject(args: {
  project_root?: string;
  context_path?: string;
  lockfile_path?: string;
  include_draft_rules?: boolean;
}) {
  try {
    const root = resolveRoot(args.project_root);
    const result = runScan({
      cwd: root,
      contextPath: args.context_path,
      lockfilePath: args.lockfile_path,
      includeDraft: Boolean(args.include_draft_rules),
    });

    return jsonResult({
      overview: explainScanOverview(result),
      summary: result.summary,
      assumptions: result.assumptions,
      highest_priority: result.highestPriority,
      findings: result.findings,
      exit: result.exitHint,
      meta: {
        root: result.rootName,
        lockfile: result.lockfilePath,
        context: result.contextPath,
        ruleset_version: result.rulesetVersion,
        scanned_at: result.scannedAt,
        disclaimer:
          "Alerts under stated assumptions only. Not legal advice. Do not invent alternatives or verdicts.",
      },
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

export async function handleExplainFinding(args: {
  project_root?: string;
  context_path?: string;
  lockfile_path?: string;
  finding_id?: string;
  package_name?: string;
}) {
  try {
    if (!args.finding_id && !args.package_name) {
      return errorResult("Provide finding_id or package_name.");
    }

    const root = resolveRoot(args.project_root);
    const result = runScan({
      cwd: root,
      contextPath: args.context_path,
      lockfilePath: args.lockfile_path,
    });

    const matches = result.findings.filter((finding) => {
      if (args.finding_id && finding.finding_id === args.finding_id) return true;
      if (args.package_name && finding.dependency.name === args.package_name) {
        return true;
      }
      return false;
    });

    if (matches.length === 0) {
      return errorResult(
        `No finding matched. finding_id=${args.finding_id ?? "(none)"} package_name=${args.package_name ?? "(none)"}`,
      );
    }

    return jsonResult({
      explanations: matches.map((finding) => ({
        finding_id: finding.finding_id,
        outcome: finding.outcome,
        package: `${finding.dependency.name}@${finding.dependency.version}`,
        text: explainFindingText(finding),
        finding,
      })),
      disclaimer:
        "Present these explanations calmly. Do not add legal conclusions or package replacements.",
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

export async function handleGetDependencyPath(args: {
  project_root?: string;
  lockfile_path?: string;
  package_name: string;
}) {
  try {
    const root = resolveRoot(args.project_root);
    const graph = loadDependencyGraph(root, args.lockfile_path);
    const matches = graph.nodes.filter(
      (node) =>
        node.name === args.package_name ||
        node.name.endsWith(`/${args.package_name}`),
    );

    if (matches.length === 0) {
      return errorResult(`Package not found: ${args.package_name}`);
    }

    return jsonResult({
      root: graph.rootName,
      matches: matches.map((node) => ({
        name: node.name,
        version: node.version,
        relationship: node.relationship,
        scopes: node.scopes,
        path: node.path,
        introduced_by: node.introducedBy,
        license_from_lockfile: node.license,
      })),
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

export async function handleCheckDependency(args: {
  project_root?: string;
  context_path?: string;
  lockfile_path?: string;
  package_name: string;
}) {
  try {
    const root = resolveRoot(args.project_root);
    const { licenses } = loadLicenseScan(root, args.lockfile_path);
    const result = runScan({
      cwd: root,
      contextPath: args.context_path,
      lockfilePath: args.lockfile_path,
    });

    const license = licenses.resolutions.filter(
      (item) => item.packageName === args.package_name,
    );
    const findings = result.findings.filter(
      (item) => item.dependency.name === args.package_name,
    );

    return jsonResult({
      package_name: args.package_name,
      license_resolutions: license,
      findings,
      note:
        findings.length === 0
          ? "No alert-worthy findings for this package under current project-context assumptions."
          : "Alert-worthy findings found. Use explain_finding for full evidence text.",
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

export async function handleGetProjectContext(args: {
  project_root?: string;
  context_path?: string;
}) {
  try {
    const root = resolveRoot(args.project_root);
    const result = loadProjectContext(root, args.context_path);
    if (!result.ok) {
      return errorResult(
        `Invalid project context (${result.path}): ${result.errors.join("; ")}`,
      );
    }
    return jsonResult({
      path: result.path,
      context: result.context,
      reminder:
        "Wrong shipping intent produces wrong alerts. Keep this file accurate.",
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

export async function handleUpdateProjectContext(args: {
  project_root?: string;
  context_path?: string;
  create_if_missing?: boolean;
  notes?: string;
  delivery?: (typeof DELIVERY_MODES)[number];
  commercial?: (typeof COMMERCIAL_OPTIONS)[number];
  source_visibility?: (typeof SOURCE_VISIBILITY)[number];
  customer_distribution?: (typeof CUSTOMER_DISTRIBUTION)[number];
  network_access?: boolean;
  modifies_dependencies?: (typeof MODIFIES_DEPENDENCIES)[number];
  linking_model?: (typeof LINKING_MODELS)[number];
  name?: string;
}) {
  try {
    const root = resolveRoot(args.project_root);
    const target = resolveContextPath(root, args.context_path);
    const existing = loadProjectContext(root, args.context_path);

    if (!existing.ok) {
      if (!args.create_if_missing) {
        return errorResult(
          `Project context missing/invalid at ${target}. Pass create_if_missing=true to create one.`,
        );
      }
      writeProjectContext(target, buildDefaultContext(args.name), {
        force: true,
      });
    }

    const patched = patchProjectContext(root, {
      path: args.context_path,
      notes: args.notes,
      project: {
        name: args.name,
        delivery: args.delivery,
        commercial: args.commercial,
        source_visibility: args.source_visibility,
        customer_distribution: args.customer_distribution,
        network_access: args.network_access,
        modifies_dependencies: args.modifies_dependencies,
        linking_model: args.linking_model,
      },
    });

    if (!patched.ok) {
      return errorResult(
        `Failed to update context (${patched.path}): ${patched.errors.join("; ")}`,
      );
    }

    return jsonResult({
      wrote: patched.wrote ?? patched.path,
      context: patched.context,
      reminder:
        "Context updated. Re-run scan_project — alerts depend on these assumptions.",
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

export async function handleListOutcomes() {
  return jsonResult({
    outcomes: {
      clear: "No relevant obligation detected under current assumptions.",
      notice: "Manageable obligations (e.g. attribution). Track them.",
      red_flag:
        "Meaningful tension with stated shipping intent — review before shipping.",
      insufficient_context:
        "Cannot evaluate safely — missing intent or architecture answers.",
      review_required:
        "Automated analysis is insufficient — escalate to a human.",
      conflict:
        "Deterministic incompatibility with declared constraints.",
    },
    guidance:
      "Prefer false caution over false comfort. Never present clear as legal approval.",
  });
}
