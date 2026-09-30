import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type {
  DependencyEdge,
  DependencyGraph,
  DependencyNode,
  DependencyRelationship,
  DependencyScope,
} from "./types.js";

export interface PypiRequirement {
  name: string;
  version?: string;
  raw: string;
}

export interface DistInfoPackage {
  name: string;
  version: string;
  /** Absolute path to *.dist-info directory */
  distInfoPath: string;
  license?: string;
  licenseExpression?: string;
  licenseClassifiers: string[];
  /** Runtime dependency names (extras excluded) */
  requires: string[];
}

const TOOLING_PACKAGES = new Set([
  "pip",
  "setuptools",
  "wheel",
  "pkg_resources",
  "distribute",
]);

export function normalizePypiName(name: string): string {
  return name.trim().toLowerCase().replace(/[-_.]+/g, "-");
}

export function findRequirementsTxt(cwd = process.cwd()): string | undefined {
  const candidate = resolve(cwd, "requirements.txt");
  return existsSync(candidate) ? candidate : undefined;
}

export function findPoetryLock(cwd = process.cwd()): string | undefined {
  const candidate = resolve(cwd, "poetry.lock");
  return existsSync(candidate) ? candidate : undefined;
}

export function findUvLock(cwd = process.cwd()): string | undefined {
  const candidate = resolve(cwd, "uv.lock");
  return existsSync(candidate) ? candidate : undefined;
}

export function findVenvRoot(cwd = process.cwd()): string | undefined {
  for (const name of [".venv", "venv", "env"]) {
    const root = resolve(cwd, name);
    if (!existsSync(root)) continue;
    if (findSitePackages(root)) return root;
  }
  return undefined;
}

export function findSitePackages(venvRoot: string): string | undefined {
  const libWin = join(venvRoot, "Lib", "site-packages");
  if (existsSync(libWin)) return libWin;

  const libDir = join(venvRoot, "lib");
  if (!existsSync(libDir)) return undefined;

  try {
    const pythons = readdirSync(libDir)
      .filter((name) => name.startsWith("python"))
      .sort()
      .reverse();
    for (const py of pythons) {
      const site = join(libDir, py, "site-packages");
      if (existsSync(site)) return site;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Parse a requirements.txt-style file for direct package pins.
 * Supports name, name==version, name>=version (version kept when exact ==).
 * Skips editable, URL, and option lines.
 */
export function parseRequirementsTxt(filePath: string): PypiRequirement[] {
  const text = readFileSync(filePath, "utf8");
  const results: PypiRequirement[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("-")) continue;
    if (/^(git\+|hg\+|svn\+|bzr\+)/i.test(line)) continue;
    if (/^https?:\/\//i.test(line) || line.includes("://")) continue;
    if (line.startsWith(".") || line.startsWith("/")) continue;

    const cleaned = line.split(/\s*;\s*/)[0]?.trim() ?? line;
    const match = cleaned.match(
      /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(==|===|>=|<=|~=|!=|>|<)?\s*([^\\s#]+)?/,
    );
    if (!match) continue;

    const name = match[1];
    const op = match[2];
    const version = op === "==" || op === "===" ? match[3] : undefined;
    results.push({ name, version, raw: line });
  }

  return results;
}

/**
 * Minimal poetry.lock package name/version extractor (no full TOML dependency).
 */
export function parsePoetryLockPackages(
  filePath: string,
): Array<{ name: string; version: string }> {
  const text = readFileSync(filePath, "utf8");
  const packages: Array<{ name: string; version: string }> = [];
  const blocks = text.split(/\n\[\[package\]\]\n/);

  for (const block of blocks.slice(1)) {
    const name = block.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
    const version = block.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
    if (name && version) packages.push({ name, version });
  }

  return packages;
}

/**
 * Minimal uv.lock package name/version extractor.
 */
export function parseUvLockPackages(
  filePath: string,
): Array<{ name: string; version: string }> {
  const text = readFileSync(filePath, "utf8");
  const packages: Array<{ name: string; version: string }> = [];
  const blocks = text.split(/\n\[\[package\]\]\n/);

  for (const block of blocks.slice(1)) {
    const name = block.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
    const version = block.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
    if (name && version) packages.push({ name, version });
  }

  return packages;
}

function parseMetadataFields(text: string): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") break; // end of headers
    const match = line.match(/^([A-Za-z0-9-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2];
    while (i + 1 < lines.length && /^\s/.test(lines[i + 1])) {
      i++;
      value += " " + lines[i].trim();
    }
    if (!fields[key]) fields[key] = [];
    fields[key].push(value);
  }

  return fields;
}

function requiresDistName(raw: string): string | undefined {
  // Skip extras-only dependencies for production graph
  if (/;\s*extra\s*==/i.test(raw)) return undefined;

  const beforeMarker = raw.split(";")[0]?.trim() ?? raw;
  const nameMatch = beforeMarker.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/);
  return nameMatch?.[1];
}

export function parseDistInfo(distInfoPath: string): DistInfoPackage | undefined {
  const metadataPath = join(distInfoPath, "METADATA");
  if (!existsSync(metadataPath)) return undefined;

  const fields = parseMetadataFields(readFileSync(metadataPath, "utf8"));
  const name = fields.Name?.[0];
  const version = fields.Version?.[0];
  if (!name || !version) return undefined;

  const licenseExpression = fields["License-Expression"]?.[0];
  const license = fields.License?.[0];
  const licenseClassifiers = (fields.Classifier ?? []).filter((c) =>
    c.startsWith("License ::"),
  );

  const requires = (fields["Requires-Dist"] ?? [])
    .map(requiresDistName)
    .filter((n): n is string => Boolean(n));

  return {
    name,
    version,
    distInfoPath,
    license,
    licenseExpression,
    licenseClassifiers,
    requires,
  };
}

export function listInstalledDistInfos(sitePackages: string): DistInfoPackage[] {
  const entries = readdirSync(sitePackages);
  const packages: DistInfoPackage[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".dist-info")) continue;
    const full = join(sitePackages, entry);
    try {
      if (!statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    const parsed = parseDistInfo(full);
    if (!parsed) continue;
    if (TOOLING_PACKAGES.has(normalizePypiName(parsed.name))) continue;
    packages.push(parsed);
  }

  return packages;
}

function preferredLicense(pkg: DistInfoPackage): string | undefined {
  if (pkg.licenseExpression?.trim()) return pkg.licenseExpression.trim();
  if (pkg.license?.trim() && pkg.license.trim().toUpperCase() !== "UNKNOWN") {
    return pkg.license.trim();
  }
  // Prefer specific classifiers later in resolve; stash first classifier as weak hint
  const classified = pkg.licenseClassifiers[0];
  return classified;
}

function pickRootName(cwd: string, requirementsPath?: string): string {
  if (requirementsPath) {
    const parent = basename(dirname(requirementsPath));
    if (parent && parent !== "." && parent !== "") return parent;
  }
  const base = basename(resolve(cwd));
  return base || "python-project";
}

function buildStats(nodes: DependencyNode[]) {
  return {
    total: nodes.length,
    direct: nodes.filter((n) => n.relationship === "direct").length,
    transitive: nodes.filter((n) => n.relationship === "transitive").length,
    production: nodes.filter((n) => n.scopes.includes("production")).length,
    development: nodes.filter((n) => n.scopes.includes("development")).length,
    withLicenseField: nodes.filter((n) => Boolean(n.license)).length,
  };
}

/**
 * Build a dependency graph from an installed virtualenv + optional direct pins.
 */
export function buildDependencyGraphFromVenv(args: {
  cwd: string;
  venvPath: string;
  sourcePath: string;
  directNames?: string[];
}): DependencyGraph {
  const site = findSitePackages(args.venvPath);
  if (!site) {
    throw new Error(`No site-packages found under venv: ${args.venvPath}`);
  }

  const installed = listInstalledDistInfos(site);
  if (installed.length === 0) {
    throw new Error(
      `Virtualenv has no installable packages with METADATA: ${args.venvPath}`,
    );
  }

  const byNorm = new Map<string, DistInfoPackage>();
  for (const pkg of installed) {
    byNorm.set(normalizePypiName(pkg.name), pkg);
  }

  const directNorms = new Set(
    (args.directNames ?? []).map(normalizePypiName).filter((n) => byNorm.has(n)),
  );

  // If no requirements declared, treat top-level packages with no in-venv parents as direct
  if (directNorms.size === 0) {
    const requiredBy = new Set<string>();
    for (const pkg of installed) {
      for (const req of pkg.requires) {
        const norm = normalizePypiName(req);
        if (byNorm.has(norm)) requiredBy.add(norm);
      }
    }
    for (const pkg of installed) {
      const norm = normalizePypiName(pkg.name);
      if (!requiredBy.has(norm)) directNorms.add(norm);
    }
  }

  const edges: DependencyEdge[] = [];
  const children = new Map<string, string[]>();

  for (const pkg of installed) {
    const fromNorm = normalizePypiName(pkg.name);
    const childNorms: string[] = [];
    for (const req of pkg.requires) {
      const toNorm = normalizePypiName(req);
      if (!byNorm.has(toNorm)) continue;
      childNorms.push(toNorm);
      edges.push({
        from: pkg.name,
        to: byNorm.get(toNorm)!.name,
        scope: "production",
      });
    }
    children.set(fromNorm, childNorms);
  }

  // BFS paths from directs
  const relationship = new Map<string, DependencyRelationship>();
  const pathByNorm = new Map<string, string[]>();
  const introducedBy = new Map<string, Set<string>>();
  const rootName = pickRootName(args.cwd, args.sourcePath);

  for (const norm of directNorms) {
    relationship.set(norm, "direct");
    const pkg = byNorm.get(norm)!;
    pathByNorm.set(norm, [rootName, pkg.name]);
    introducedBy.set(norm, new Set());
  }

  const queue = [...directNorms];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentPkg = byNorm.get(current)!;
    const currentPath = pathByNorm.get(current) ?? [rootName, currentPkg.name];

    for (const child of children.get(current) ?? []) {
      if (!introducedBy.has(child)) introducedBy.set(child, new Set());
      introducedBy.get(child)!.add(currentPkg.name);

      if (!relationship.has(child)) {
        relationship.set(child, "transitive");
        const childPkg = byNorm.get(child)!;
        pathByNorm.set(child, [...currentPath, childPkg.name]);
        queue.push(child);
      }
    }
  }

  // Packages installed but unreachable from directs (e.g. leftover) → still include as transitive/unknown path
  const nodes: DependencyNode[] = [];
  for (const pkg of installed) {
    const norm = normalizePypiName(pkg.name);
    const rel = relationship.get(norm) ?? "transitive";
    const lockfileKey = relative(args.cwd, pkg.distInfoPath).replace(/\\/g, "/");
    const path = pathByNorm.get(norm) ?? [rootName, pkg.name];
    const parents = [...(introducedBy.get(norm) ?? [])];

    nodes.push({
      name: pkg.name,
      version: pkg.version,
      lockfileKey,
      relationship: rel,
      scopes: ["production"] as DependencyScope[],
      license: preferredLicense(pkg),
      path,
      introducedBy: parents,
      dependencyCount: (children.get(norm) ?? []).length,
    });
  }

  nodes.sort((a, b) => a.name.localeCompare(b.name));

  return {
    rootName,
    rootVersion: "0.0.0",
    lockfilePath: resolve(args.sourcePath),
    lockfileVersion: 1,
    packageManager: "pypi",
    nodes,
    edges,
    stats: buildStats(nodes),
  };
}

/**
 * Build graph from poetry.lock / uv.lock package list when no venv is available.
 * Licenses will be unresolved until registry/metadata evidence is attached later.
 */
export function buildDependencyGraphFromPypiLock(args: {
  cwd: string;
  lockfilePath: string;
  kind: "poetry.lock" | "uv.lock";
}): DependencyGraph {
  const packages =
    args.kind === "poetry.lock"
      ? parsePoetryLockPackages(args.lockfilePath)
      : parseUvLockPackages(args.lockfilePath);

  if (packages.length === 0) {
    throw new Error(`No packages found in ${args.lockfilePath}`);
  }

  const rootName = pickRootName(args.cwd, args.lockfilePath);
  const nodes: DependencyNode[] = packages
    .filter((p) => !TOOLING_PACKAGES.has(normalizePypiName(p.name)))
    .map((p) => ({
      name: p.name,
      version: p.version,
      lockfileKey: `pypi:${normalizePypiName(p.name)}@${p.version}`,
      relationship: "direct" as const,
      scopes: ["production"] as DependencyScope[],
      path: [rootName, p.name],
      introducedBy: [] as string[],
      dependencyCount: 0,
    }));

  // Without dependency edges in the minimal parser, treat all as direct with a note via path
  // Prefer venv when available for accurate relationship.
  return {
    rootName,
    rootVersion: "0.0.0",
    lockfilePath: resolve(args.lockfilePath),
    lockfileVersion: 1,
    packageManager: "pypi",
    nodes,
    edges: [],
    stats: buildStats(nodes),
  };
}

export function loadPypiDependencyGraph(
  cwd: string,
  sourcePath: string,
  sourceKind: "poetry.lock" | "uv.lock" | "requirements.txt" | "venv",
  venvPath?: string,
): DependencyGraph {
  const directNames: string[] = [];

  if (sourceKind === "requirements.txt") {
    directNames.push(
      ...parseRequirementsTxt(sourcePath).map((r) => r.name),
    );
  } else if (sourceKind === "poetry.lock") {
    directNames.push(
      ...parsePoetryLockPackages(sourcePath).map((p) => p.name),
    );
  } else if (sourceKind === "uv.lock") {
    directNames.push(...parseUvLockPackages(sourcePath).map((p) => p.name));
  }

  if (venvPath) {
    // requirements.txt lists true directs. poetry.lock/uv.lock list the full
    // locked set, so with a venv we infer directs from the installed Requires-Dist graph.
    const directsForVenv =
      sourceKind === "requirements.txt" && directNames.length > 0
        ? directNames
        : undefined;

    return buildDependencyGraphFromVenv({
      cwd,
      venvPath,
      sourcePath,
      directNames: directsForVenv,
    });
  }

  if (sourceKind === "poetry.lock" || sourceKind === "uv.lock") {
    return buildDependencyGraphFromPypiLock({
      cwd,
      lockfilePath: sourcePath,
      kind: sourceKind,
    });
  }

  throw new Error(
    "PyPI scan needs a virtualenv (.venv/venv) or a poetry.lock/uv.lock file.",
  );
}
