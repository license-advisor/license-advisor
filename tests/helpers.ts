import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DependencyGraph, DependencyNode } from "../src/graph/types.js";
import type {
  LicenseResolution,
  LicenseScanResult,
} from "../src/licenses/types.js";
import type { ProjectContext } from "../src/types.js";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, "..");
export const fixturesRoot = join(repoRoot, "fixtures");

export function saasAgplFixture() {
  const dir = join(fixturesRoot, "saas-agpl");
  return {
    dir,
    contextPath: join(dir, "project-context.yaml"),
    lockfilePath: join(dir, "package-lock.json"),
  };
}

export function npmFixture() {
  const dir = join(fixturesRoot, "npm");
  return {
    dir,
    lockfilePath: join(dir, "package-lock.json"),
  };
}

export function pypiFixture() {
  const dir = join(fixturesRoot, "pypi");
  return {
    dir,
    requirementsPath: join(dir, "requirements.txt"),
    contextPath: join(dir, "project-context.yaml"),
    venvPath: join(dir, ".venv"),
  };
}

export function baseSaasContext(
  overrides: Partial<ProjectContext["project"]> = {},
): ProjectContext {
  return {
    schema_version: "0.1.0",
    project: {
      name: "test-app",
      delivery: "hosted_saas",
      commercial: "yes",
      audience: "third_parties",
      source_visibility: "closed",
      customer_distribution: "none",
      network_access: true,
      modifies_dependencies: "unknown",
      linking_model: "unknown",
      dependency_scopes_in_scope: ["production"],
      ...overrides,
    },
    policy: {
      fail_on: ["conflict"],
      warn_on: ["red_flag", "review_required"],
    },
  };
}

export function makeNode(
  partial: Partial<DependencyNode> & Pick<DependencyNode, "name" | "version">,
): DependencyNode {
  return {
    lockfileKey: `node_modules/${partial.name}`,
    relationship: "direct",
    scopes: ["production"],
    path: ["test-app", partial.name],
    introducedBy: [],
    dependencyCount: 0,
    ...partial,
  };
}

export function makeResolution(
  partial: Partial<LicenseResolution> &
    Pick<LicenseResolution, "packageName" | "version" | "status">,
): LicenseResolution {
  const lockfileKey =
    partial.lockfileKey ?? `node_modules/${partial.packageName}`;
  return {
    lockfileKey,
    concluded: partial.concluded,
    spdxIds: partial.spdxIds ?? (partial.concluded ? [partial.concluded] : []),
    evidence: partial.evidence ?? [
      {
        type: "package_metadata",
        value: partial.concluded ?? "(unknown)",
        source: "test",
        confidence: 0.9,
        normalized: partial.concluded,
      },
    ],
    notes: partial.notes ?? [],
    ...partial,
  };
}

export function makeGraph(nodes: DependencyNode[]): DependencyGraph {
  return {
    rootName: "test-app",
    rootVersion: "1.0.0",
    lockfilePath: "/tmp/test-package-lock.json",
    lockfileVersion: 3,
    packageManager: "npm",
    nodes,
    edges: [],
    stats: {
      total: nodes.length,
      direct: nodes.filter((n) => n.relationship === "direct").length,
      transitive: nodes.filter((n) => n.relationship === "transitive").length,
      production: nodes.filter((n) => n.scopes.includes("production")).length,
      development: nodes.filter((n) => n.scopes.includes("development")).length,
      withLicenseField: nodes.filter((n) => Boolean(n.license)).length,
    },
  };
}

export function makeLicenseScan(
  resolutions: LicenseResolution[],
): LicenseScanResult {
  return {
    lockfilePath: "/tmp/test-package-lock.json",
    rootName: "test-app",
    resolutions,
    stats: {
      total: resolutions.length,
      resolved: resolutions.filter((r) => r.status === "resolved").length,
      unresolved: resolutions.filter((r) => r.status === "unresolved").length,
      conflicting: resolutions.filter((r) => r.status === "conflicting").length,
      expression: resolutions.filter((r) => r.status === "expression").length,
    },
  };
}
