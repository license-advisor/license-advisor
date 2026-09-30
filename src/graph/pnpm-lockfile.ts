import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type {
  DependencyEdge,
  DependencyGraph,
  DependencyNode,
  DependencyRelationship,
  DependencyScope,
} from "./types.js";

interface PnpmImporterDeps {
  [name: string]: { specifier?: string; version?: string } | string;
}

interface PnpmLockfile {
  lockfileVersion?: string | number;
  importers?: Record<
    string,
    {
      dependencies?: PnpmImporterDeps;
      devDependencies?: PnpmImporterDeps;
      optionalDependencies?: PnpmImporterDeps;
    }
  >;
  dependencies?: PnpmImporterDeps;
  devDependencies?: PnpmImporterDeps;
  optionalDependencies?: PnpmImporterDeps;
  packages?: Record<
    string,
    {
      resolution?: unknown;
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      dev?: boolean;
      name?: string;
      version?: string;
    }
  >;
  snapshots?: Record<
    string,
    {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    }
  >;
}

function readRootPackageJson(lockfilePath: string): {
  name: string;
  version: string;
} {
  const pkgPath = join(dirname(lockfilePath), "package.json");
  if (!existsSync(pkgPath)) {
    return { name: "project", version: "0.0.0" };
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      name?: string;
      version?: string;
    };
    return {
      name: pkg.name ?? "project",
      version: pkg.version ?? "0.0.0",
    };
  } catch {
    return { name: "project", version: "0.0.0" };
  }
}

/**
 * Parse pnpm package keys:
 * - v6: /express@4.18.2  or /@scope/name@1.0.0
 * - v9: express@4.18.2   or @scope/name@1.0.0
 */
export function parsePnpmPackageKey(key: string): {
  name: string;
  version: string;
} | undefined {
  let cleaned = key.startsWith("/") ? key.slice(1) : key;
  const paren = cleaned.indexOf("(");
  if (paren !== -1) cleaned = cleaned.slice(0, paren);
  if (!cleaned) return undefined;

  if (cleaned.startsWith("@")) {
    const at = cleaned.indexOf("@", 1);
    if (at === -1) return undefined;
    return {
      name: cleaned.slice(0, at),
      version: cleaned.slice(at + 1),
    };
  }

  const at = cleaned.lastIndexOf("@");
  if (at <= 0) return undefined;
  return {
    name: cleaned.slice(0, at),
    version: cleaned.slice(at + 1),
  };
}

function depNames(deps?: PnpmImporterDeps): string[] {
  if (!deps) return [];
  return Object.keys(deps);
}

function depVersionMap(
  deps?: Record<string, string> | PnpmImporterDeps,
): Record<string, string> {
  if (!deps) return {};
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(deps)) {
    if (typeof value === "string") {
      out[name] = value;
    } else if (value && typeof value === "object" && value.version) {
      out[name] = value.version;
    } else {
      out[name] = "*";
    }
  }
  return out;
}

function nodeModulesKey(name: string): string {
  return `node_modules/${name}`;
}

export function findPnpmLockfile(cwd = process.cwd()): string | undefined {
  const candidate = resolve(cwd, "pnpm-lock.yaml");
  return existsSync(candidate) ? candidate : undefined;
}

export function loadPnpmLockfile(lockfilePath: string): PnpmLockfile {
  if (!existsSync(lockfilePath)) {
    throw new Error(`Lockfile not found: ${lockfilePath}`);
  }
  const raw = parseYaml(readFileSync(lockfilePath, "utf8")) as PnpmLockfile;
  if (!raw.packages || Object.keys(raw.packages).length === 0) {
    throw new Error(`Unsupported or empty pnpm lockfile: ${lockfilePath}`);
  }
  return raw;
}

export function buildDependencyGraphFromPnpmLock(
  lockfilePath: string,
): DependencyGraph {
  const absolute = resolve(lockfilePath);
  const lock = loadPnpmLockfile(absolute);
  const rootPkg = readRootPackageJson(absolute);
  const lockfileVersion = Number.parseFloat(String(lock.lockfileVersion ?? "1"));

  // name -> { version, deps, isDev }
  const byName = new Map<
    string,
    {
      version: string;
      dependencies: Record<string, string>;
      isDev: boolean;
      lockKey: string;
    }
  >();

  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    const parsed = parsePnpmPackageKey(key);
    if (!parsed) continue;
    const snap = lock.snapshots?.[key];
    const dependencies = {
      ...depVersionMap(entry.dependencies),
      ...depVersionMap(snap?.dependencies),
    };
    // Prefer first seen version; lockfile usually one entry per name@version
    const existing = byName.get(parsed.name);
    if (existing && existing.version !== parsed.version) {
      // Keep the first; fixture graphs are simple. Real projects may hoist.
      continue;
    }
    byName.set(parsed.name, {
      version: parsed.version,
      dependencies,
      isDev: Boolean(entry.dev),
      lockKey: key,
    });
  }

  // Root directs
  const importer =
    lock.importers?.["."] ??
    lock.importers?.["./"] ??
    Object.values(lock.importers ?? {})[0];

  const directProd = new Set([
    ...depNames(importer?.dependencies ?? lock.dependencies),
  ]);
  const directDev = new Set([
    ...depNames(importer?.devDependencies ?? lock.devDependencies),
  ]);
  const directOpt = new Set([
    ...depNames(importer?.optionalDependencies ?? lock.optionalDependencies),
  ]);

  const edges: DependencyEdge[] = [];
  const children = new Map<string, Array<{ name: string; scope: DependencyScope }>>();

  for (const [name, pkg] of byName) {
    const list: Array<{ name: string; scope: DependencyScope }> = [];
    for (const [depName] of Object.entries(pkg.dependencies)) {
      if (!byName.has(depName)) continue;
      list.push({ name: depName, scope: "production" });
      edges.push({
        from: name,
        to: depName,
        scope: "production",
      });
    }
    children.set(name, list);
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
  for (const name of directOpt) {
    if (!byName.has(name)) continue;
    relationship.set(name, "direct");
    pathByName.set(name, [rootPkg.name, name]);
    introducedBy.set(name, new Set());
    if (!scopesByName.has(name)) scopesByName.set(name, new Set());
    scopesByName.get(name)!.add("optional");
    if (!queue.includes(name)) queue.push(name);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentPath = pathByName.get(current) ?? [rootPkg.name, current];
    for (const child of children.get(current) ?? []) {
      if (!introducedBy.has(child.name)) introducedBy.set(child.name, new Set());
      introducedBy.get(child.name)!.add(current);

      if (!scopesByName.has(child.name)) scopesByName.set(child.name, new Set());
      scopesByName.get(child.name)!.add(child.scope);

      if (!relationship.has(child.name)) {
        relationship.set(child.name, "transitive");
        pathByName.set(child.name, [...currentPath, child.name]);
        queue.push(child.name);
      }
    }
  }

  const nodes: DependencyNode[] = [];
  for (const [name, pkg] of byName) {
    const rel = relationship.get(name);
    if (!rel) continue; // unreachable from root directs
    const scopes = [...(scopesByName.get(name) ?? ["production"])];
    nodes.push({
      name,
      version: pkg.version,
      lockfileKey: nodeModulesKey(name),
      relationship: rel,
      scopes,
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
    lockfileVersion: Number.isFinite(lockfileVersion) ? lockfileVersion : 1,
    packageManager: "pnpm",
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
