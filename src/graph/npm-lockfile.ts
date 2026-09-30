import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type {
  DependencyEdge,
  DependencyGraph,
  DependencyNode,
  DependencyScope,
  LockfilePackage,
} from "./types.js";

interface NpmLockfileV2 {
  name?: string;
  version?: string;
  lockfileVersion: number;
  packages?: Record<string, NpmPackageEntry>;
  dependencies?: Record<string, NpmLockfileV1Node>;
}

interface NpmPackageEntry {
  name?: string;
  version?: string;
  license?: string | { type?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  dev?: boolean;
  optional?: boolean;
  peer?: boolean;
  link?: boolean;
  resolved?: string;
  extraneous?: boolean;
}

interface NpmLockfileV1Node {
  version?: string;
  requires?: Record<string, string>;
  dependencies?: Record<string, NpmLockfileV1Node>;
  dev?: boolean;
  optional?: boolean;
  peer?: boolean;
  license?: string;
  resolved?: string;
}

function normalizeLicense(
  license: string | { type?: string } | undefined,
): string | undefined {
  if (!license) return undefined;
  if (typeof license === "string") return license;
  return license.type;
}

function packageNameFromKey(lockfileKey: string, explicitName?: string): string {
  if (explicitName) return explicitName;
  if (lockfileKey === "") return "(root)";

  // "node_modules/foo" or "node_modules/@scope/bar" or nested paths
  const marker = "node_modules/";
  const idx = lockfileKey.lastIndexOf(marker);
  if (idx === -1) return lockfileKey;

  return lockfileKey.slice(idx + marker.length);
}

function parentKey(lockfileKey: string): string {
  if (lockfileKey === "" || !lockfileKey.includes("node_modules/")) {
    return "";
  }

  const marker = "/node_modules/";
  const idx = lockfileKey.lastIndexOf(marker);
  if (idx === -1) {
    // top-level node_modules/pkg
    return "";
  }
  return lockfileKey.slice(0, idx);
}

/**
 * Resolve a dependency name from a parent lockfile key to a packages[] key.
 * Mirrors npm's nested node_modules lookup.
 */
export function resolveDependencyKey(
  parentLockfileKey: string,
  depName: string,
  packageKeys: Set<string>,
): string | undefined {
  let current = parentLockfileKey;

  while (true) {
    const candidate =
      current === ""
        ? `node_modules/${depName}`
        : `${current}/node_modules/${depName}`;

    if (packageKeys.has(candidate)) {
      return candidate;
    }

    if (current === "") {
      return undefined;
    }

    current = parentKey(current);
  }
}

function scopesFromRootDeclaration(
  root: NpmPackageEntry,
): Map<string, DependencyScope[]> {
  const map = new Map<string, DependencyScope[]>();

  const add = (deps: Record<string, string> | undefined, scope: DependencyScope) => {
    if (!deps) return;
    for (const name of Object.keys(deps)) {
      const existing = map.get(name) ?? [];
      if (!existing.includes(scope)) existing.push(scope);
      map.set(name, existing);
    }
  };

  add(root.dependencies, "production");
  add(root.devDependencies, "development");
  add(root.optionalDependencies, "optional");
  add(root.peerDependencies, "peer");

  return map;
}

function parsePackagesMap(lockfile: NpmLockfileV2): Map<string, LockfilePackage> {
  const packages = lockfile.packages;
  if (!packages || typeof packages !== "object") {
    throw new Error(
      "Unsupported or empty lockfile: expected npm lockfileVersion 2/3 with a packages map.",
    );
  }

  const result = new Map<string, LockfilePackage>();

  for (const [key, entry] of Object.entries(packages)) {
    const name = packageNameFromKey(key, entry.name);
    result.set(key, {
      lockfileKey: key,
      name,
      version: entry.version ?? "0.0.0",
      license: normalizeLicense(entry.license),
      dependencies: entry.dependencies ?? {},
      devDependencies: entry.devDependencies ?? {},
      optionalDependencies: entry.optionalDependencies ?? {},
      peerDependencies: entry.peerDependencies ?? {},
      scopes: [],
      isDev: Boolean(entry.dev),
      isOptional: Boolean(entry.optional),
      link: entry.link,
      resolved: entry.resolved,
    });
  }

  return result;
}

function collectEdges(
  packages: Map<string, LockfilePackage>,
): DependencyEdge[] {
  const keys = new Set(packages.keys());
  const edges: DependencyEdge[] = [];

  for (const pkg of packages.values()) {
    const fromName = pkg.lockfileKey === "" ? "(root)" : pkg.name;

    const declare = (
      deps: Record<string, string>,
      scope: DependencyScope,
    ) => {
      for (const [depName, range] of Object.entries(deps)) {
        const targetKey = resolveDependencyKey(pkg.lockfileKey, depName, keys);
        if (!targetKey) continue;
        const target = packages.get(targetKey);
        if (!target) continue;

        edges.push({
          from: fromName,
          to: target.name,
          range,
          scope,
        });
      }
    };

    declare(pkg.dependencies, "production");
    declare(pkg.devDependencies, "development");
    declare(pkg.optionalDependencies, "optional");
    declare(pkg.peerDependencies, "peer");
  }

  return edges;
}

function buildNodes(
  packages: Map<string, LockfilePackage>,
  rootDirectScopes: Map<string, DependencyScope[]>,
): DependencyNode[] {
  const keys = new Set(packages.keys());
  const root = packages.get("");
  if (!root) {
    throw new Error("Lockfile missing root package entry (packages[\"\"]).");
  }

  // adjacency: lockfileKey -> child lockfileKeys with scope
  const children = new Map<string, Array<{ key: string; scope: DependencyScope }>>();

  for (const pkg of packages.values()) {
    const list: Array<{ key: string; scope: DependencyScope }> = [];

    const addDeps = (
      deps: Record<string, string>,
      scope: DependencyScope,
    ) => {
      for (const depName of Object.keys(deps)) {
        const targetKey = resolveDependencyKey(pkg.lockfileKey, depName, keys);
        if (targetKey) list.push({ key: targetKey, scope });
      }
    };

    addDeps(pkg.dependencies, "production");
    addDeps(pkg.devDependencies, "development");
    addDeps(pkg.optionalDependencies, "optional");
    addDeps(pkg.peerDependencies, "peer");
    children.set(pkg.lockfileKey, list);
  }

  const pathByKey = new Map<string, string[]>();
  const introducedBy = new Map<string, Set<string>>();
  const scopesByKey = new Map<string, Set<DependencyScope>>();
  const relationship = new Map<string, "direct" | "transitive">();
  const visited = new Set<string>();

  // BFS from root for representative paths
  const queue: Array<{ key: string; path: string[]; scope: DependencyScope | null }> =
    [{ key: "", path: [root.name === "(root)" ? root.name : root.name], scope: null }];

  pathByKey.set("", [root.name]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (visited.has(current.key)) continue;
    visited.add(current.key);

    const kids = children.get(current.key) ?? [];
    for (const child of kids) {
      const childPkg = packages.get(child.key);
      if (!childPkg) continue;

      const parentName =
        current.key === "" ? "(root)" : packages.get(current.key)?.name ?? "(root)";

      if (!introducedBy.has(child.key)) {
        introducedBy.set(child.key, new Set());
      }
      if (parentName !== "(root)") {
        introducedBy.get(child.key)?.add(parentName);
      } else {
        // direct from root — keep empty introducedBy or mark root
        introducedBy.get(child.key)?.add("(root)");
      }

      if (!scopesByKey.has(child.key)) {
        scopesByKey.set(child.key, new Set());
      }
      scopesByKey.get(child.key)?.add(child.scope);

      // Direct if declared on root
      if (current.key === "" && rootDirectScopes.has(childPkg.name)) {
        relationship.set(child.key, "direct");
        const rootScopes = rootDirectScopes.get(childPkg.name) ?? [];
        for (const s of rootScopes) scopesByKey.get(child.key)?.add(s);
      } else if (!relationship.has(child.key)) {
        relationship.set(child.key, "transitive");
      }

      if (!pathByKey.has(child.key)) {
        const nextPath = [...current.path, childPkg.name];
        pathByKey.set(child.key, nextPath);
        queue.push({ key: child.key, path: nextPath, scope: child.scope });
      } else {
        // Still explore for completeness if not visited — handled by visited on parent pop
        if (!visited.has(child.key)) {
          queue.push({
            key: child.key,
            path: pathByKey.get(child.key) ?? [...current.path, childPkg.name],
            scope: child.scope,
          });
        }
      }
    }
  }

  // Also mark any package present but unreachable as transitive unknown path
  const nodes: DependencyNode[] = [];

  for (const pkg of packages.values()) {
    if (pkg.lockfileKey === "") continue;

    const rel = relationship.get(pkg.lockfileKey) ?? "transitive";
    const scopes = [
      ...(scopesByKey.get(pkg.lockfileKey) ??
        new Set<DependencyScope>(
          rootDirectScopes.get(pkg.name) ??
            (pkg.isDev ? ["development"] : ["production"]),
        )),
    ];

    // Prefer root declaration scopes for direct deps
    if (rel === "direct" && rootDirectScopes.has(pkg.name)) {
      const declared = rootDirectScopes.get(pkg.name) ?? scopes;
      for (const s of declared) {
        if (!scopes.includes(s)) scopes.push(s);
      }
    }

    const path = pathByKey.get(pkg.lockfileKey) ?? ["(root)", pkg.name];
    const parents = [...(introducedBy.get(pkg.lockfileKey) ?? [])].filter(
      (p) => p !== "(root)",
    );

    nodes.push({
      name: pkg.name,
      version: pkg.version,
      lockfileKey: pkg.lockfileKey,
      relationship: rel,
      scopes: scopes.length > 0 ? scopes : ["unknown"],
      license: pkg.license,
      path,
      introducedBy: parents,
      dependencyCount:
        Object.keys(pkg.dependencies).length +
        Object.keys(pkg.devDependencies).length +
        Object.keys(pkg.optionalDependencies).length,
    });
  }

  // Deduplicate by name@version keeping shortest path / prefer top-level key
  nodes.sort((a, b) => {
    if (a.relationship !== b.relationship) {
      return a.relationship === "direct" ? -1 : 1;
    }
    return a.name.localeCompare(b.name) || a.version.localeCompare(b.version);
  });

  return nodes;
}

export function findNpmLockfile(cwd = process.cwd()): string | undefined {
  const candidate = resolve(cwd, "package-lock.json");
  return existsSync(candidate) ? candidate : undefined;
}

export function loadNpmLockfile(lockfilePath: string): NpmLockfileV2 {
  if (!existsSync(lockfilePath)) {
    throw new Error(`Lockfile not found: ${lockfilePath}`);
  }

  const raw = JSON.parse(readFileSync(lockfilePath, "utf8")) as NpmLockfileV2;
  if (!raw.lockfileVersion || raw.lockfileVersion < 2) {
    throw new Error(
      `Unsupported lockfileVersion ${String(raw.lockfileVersion)}. Need npm lockfile v2 or v3 (packages map).`,
    );
  }
  return raw;
}

export function buildDependencyGraphFromLockfile(
  lockfilePath: string,
): DependencyGraph {
  const absolute = resolve(lockfilePath);
  const lockfile = loadNpmLockfile(absolute);
  const packages = parsePackagesMap(lockfile);
  const root = packages.get("");
  if (!root) {
    throw new Error("Lockfile missing root package entry.");
  }

  // If root name is still "(root)", try lockfile name / nearby package.json
  let rootName = lockfile.name ?? root.name;
  if (!rootName || rootName === "(root)") {
    const pkgJsonPath = join(dirname(absolute), "package.json");
    if (existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
        name?: string;
      };
      rootName = pkg.name ?? basename(dirname(absolute));
    } else {
      rootName = basename(dirname(absolute));
    }
    root.name = rootName;
  }

  const rootEntry = lockfile.packages?.[""] ?? {};
  const rootDirectScopes = scopesFromRootDeclaration(rootEntry);
  const nodes = buildNodes(packages, rootDirectScopes);
  const edges = collectEdges(packages);

  const direct = nodes.filter((n) => n.relationship === "direct");
  const transitive = nodes.filter((n) => n.relationship === "transitive");

  return {
    rootName,
    rootVersion: lockfile.version ?? root.version,
    lockfilePath: absolute,
    lockfileVersion: lockfile.lockfileVersion,
    packageManager: "npm",
    nodes,
    edges,
    stats: {
      total: nodes.length,
      direct: direct.length,
      transitive: transitive.length,
      production: nodes.filter((n) => n.scopes.includes("production")).length,
      development: nodes.filter((n) => n.scopes.includes("development")).length,
      withLicenseField: nodes.filter((n) => Boolean(n.license)).length,
    },
  };
}

/** @deprecated Prefer loadDependencyGraph from ./load.js (multi-ecosystem). */
export function loadNpmDependencyGraph(
  cwd = process.cwd(),
  explicitLockfile?: string,
): DependencyGraph {
  const lockfilePath = explicitLockfile
    ? resolve(cwd, explicitLockfile)
    : findNpmLockfile(cwd);

  if (!lockfilePath) {
    throw new Error(
      "No package-lock.json found. Run from an npm project or pass --lockfile.",
    );
  }

  return buildDependencyGraphFromLockfile(lockfilePath);
}
