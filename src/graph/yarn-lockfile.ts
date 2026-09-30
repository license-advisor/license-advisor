import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type {
  DependencyEdge,
  DependencyGraph,
  DependencyNode,
  DependencyRelationship,
  DependencyScope,
} from "./types.js";

interface YarnPackage {
  name: string;
  version: string;
  dependencies: Record<string, string>;
}

function readRootPackageJson(lockfilePath: string): {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  const pkgPath = join(dirname(lockfilePath), "package.json");
  if (!existsSync(pkgPath)) {
    return {
      name: "project",
      version: "0.0.0",
      dependencies: {},
      devDependencies: {},
    };
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      name?: string;
      version?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      name: pkg.name ?? "project",
      version: pkg.version ?? "0.0.0",
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
    };
  } catch {
    return {
      name: "project",
      version: "0.0.0",
      dependencies: {},
      devDependencies: {},
    };
  }
}

/**
 * Extract package name from a yarn v1 descriptor line key.
 * Examples: express@^4.18.2 → express ; @scope/name@^1.0.0 → @scope/name
 */
export function yarnDescriptorName(descriptor: string): string {
  const trimmed = descriptor.trim().replace(/^"|"$/g, "");
  if (trimmed.startsWith("@")) {
    const at = trimmed.indexOf("@", 1);
    return at === -1 ? trimmed : trimmed.slice(0, at);
  }
  const at = trimmed.indexOf("@");
  return at === -1 ? trimmed : trimmed.slice(0, at);
}

/**
 * Parse Yarn classic (v1) yarn.lock into name → package entries.
 */
export function parseYarnLockV1(text: string): Map<string, YarnPackage> {
  const byName = new Map<string, YarnPackage>();
  const lines = text.split(/\r?\n/);

  let descriptors: string[] = [];
  let version: string | undefined;
  let dependencies: Record<string, string> = {};
  let inDependencies = false;

  const flush = () => {
    if (descriptors.length === 0 || !version) {
      descriptors = [];
      version = undefined;
      dependencies = {};
      inDependencies = false;
      return;
    }
    for (const descriptor of descriptors) {
      const name = yarnDescriptorName(descriptor);
      if (!byName.has(name)) {
        byName.set(name, {
          name,
          version,
          dependencies: { ...dependencies },
        });
      }
    }
    descriptors = [];
    version = undefined;
    dependencies = {};
    inDependencies = false;
  };

  for (const raw of lines) {
    if (!raw.trim() || raw.trimStart().startsWith("#")) {
      if (!raw.trim()) flush();
      continue;
    }

    // New entry header: foo@^1.0.0: or "foo@npm:1.0.0":
    if (!raw.startsWith(" ") && raw.trimEnd().endsWith(":")) {
      flush();
      const header = raw.trim().slice(0, -1);
      descriptors = header.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
      continue;
    }

    const indented = raw.match(/^ {2}(\S.*?):\s*$/);
    if (indented) {
      inDependencies = indented[1] === "dependencies";
      continue;
    }

    const versionMatch = raw.match(/^ {2}version\s+"([^"]+)"/);
    if (versionMatch) {
      version = versionMatch[1];
      inDependencies = false;
      continue;
    }

    if (inDependencies) {
      const depMatch = raw.match(/^ {4}(\S+)\s+"([^"]+)"/);
      if (depMatch) {
        dependencies[depMatch[1]] = depMatch[2];
      }
    }
  }
  flush();

  return byName;
}

export function findYarnLockfile(cwd = process.cwd()): string | undefined {
  const candidate = resolve(cwd, "yarn.lock");
  return existsSync(candidate) ? candidate : undefined;
}

export function buildDependencyGraphFromYarnLock(
  lockfilePath: string,
): DependencyGraph {
  const absolute = resolve(lockfilePath);
  if (!existsSync(absolute)) {
    throw new Error(`Lockfile not found: ${absolute}`);
  }

  const text = readFileSync(absolute, "utf8");
  if (text.includes("__metadata:") || text.includes("yarn lockfile v2")) {
    throw new Error(
      "Yarn Berry (v2+) lockfiles are not supported yet. Use yarn classic (v1) yarn.lock, or export a package-lock.json / pnpm-lock.yaml.",
    );
  }

  const byName = parseYarnLockV1(text);
  if (byName.size === 0) {
    throw new Error(`No packages found in yarn.lock: ${absolute}`);
  }

  const rootPkg = readRootPackageJson(absolute);
  const directProd = new Set(Object.keys(rootPkg.dependencies));
  const directDev = new Set(Object.keys(rootPkg.devDependencies));

  const edges: DependencyEdge[] = [];
  const children = new Map<string, string[]>();

  for (const [name, pkg] of byName) {
    const childNames: string[] = [];
    for (const depName of Object.keys(pkg.dependencies)) {
      if (!byName.has(depName)) continue;
      childNames.push(depName);
      edges.push({ from: name, to: depName, scope: "production" });
    }
    children.set(name, childNames);
  }

  const relationship = new Map<string, DependencyRelationship>();
  const pathByName = new Map<string, string[]>();
  const introducedBy = new Map<string, Set<string>>();
  const scopesByName = new Map<string, Set<DependencyScope>>();
  const queue: string[] = [];

  for (const name of directProd) {
    if (!byName.has(name)) continue;
    relationship.set(name, "direct");
    pathByName.set(name, [rootPkg.name, name]);
    introducedBy.set(name, new Set());
    scopesByName.set(name, new Set(["production"]));
    queue.push(name);
  }
  for (const name of directDev) {
    if (!byName.has(name)) continue;
    relationship.set(name, "direct");
    pathByName.set(name, [rootPkg.name, name]);
    introducedBy.set(name, new Set());
    if (!scopesByName.has(name)) scopesByName.set(name, new Set());
    scopesByName.get(name)!.add("development");
    if (!queue.includes(name)) queue.push(name);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentPath = pathByName.get(current) ?? [rootPkg.name, current];
    for (const child of children.get(current) ?? []) {
      if (!introducedBy.has(child)) introducedBy.set(child, new Set());
      introducedBy.get(child)!.add(current);
      if (!scopesByName.has(child)) scopesByName.set(child, new Set());
      scopesByName.get(child)!.add("production");
      if (!relationship.has(child)) {
        relationship.set(child, "transitive");
        pathByName.set(child, [...currentPath, child]);
        queue.push(child);
      }
    }
  }

  const nodes: DependencyNode[] = [];
  for (const [name, pkg] of byName) {
    const rel = relationship.get(name);
    if (!rel) continue;
    nodes.push({
      name,
      version: pkg.version,
      lockfileKey: `node_modules/${name}`,
      relationship: rel,
      scopes: [...(scopesByName.get(name) ?? ["production"])],
      path: pathByName.get(name) ?? [rootPkg.name, name],
      introducedBy: [...(introducedBy.get(name) ?? [])],
      dependencyCount: (children.get(name) ?? []).length,
    });
  }

  nodes.sort((a, b) => a.name.localeCompare(b.name));

  return {
    rootName: rootPkg.name,
    rootVersion: rootPkg.version,
    lockfilePath: absolute,
    lockfileVersion: 1,
    packageManager: "yarn",
    nodes,
    edges,
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
