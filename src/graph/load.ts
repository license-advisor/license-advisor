import { dirname, resolve } from "node:path";
import { discoverManifest } from "./discover.js";
import {
  buildDependencyGraphFromLockfile,
  findNpmLockfile,
} from "./npm-lockfile.js";
import {
  buildDependencyGraphFromPnpmLock,
  findPnpmLockfile,
} from "./pnpm-lockfile.js";
import {
  findPoetryLock,
  findRequirementsTxt,
  findUvLock,
  loadPypiDependencyGraph,
} from "./pypi.js";
import {
  buildDependencyGraphFromYarnLock,
  findYarnLockfile,
} from "./yarn-lockfile.js";
import type { DependencyGraph } from "./types.js";

/**
 * Load a dependency graph for the discovered ecosystem.
 */
export function loadDependencyGraph(
  cwd = process.cwd(),
  explicitSource?: string,
): DependencyGraph {
  const root = resolve(cwd);
  const manifest = discoverManifest(root, explicitSource);

  if (manifest.packageManager === "npm") {
    return buildDependencyGraphFromLockfile(manifest.sourcePath);
  }

  if (manifest.packageManager === "pnpm") {
    return buildDependencyGraphFromPnpmLock(manifest.sourcePath);
  }

  if (manifest.packageManager === "yarn") {
    return buildDependencyGraphFromYarnLock(manifest.sourcePath);
  }

  if (manifest.sourceKind === "package-lock.json") {
    throw new Error("Internal error: npm manifest classified as PyPI.");
  }

  if (
    manifest.sourceKind === "pnpm-lock.yaml" ||
    manifest.sourceKind === "yarn.lock"
  ) {
    throw new Error("Internal error: JS lockfile classified as PyPI.");
  }

  return loadPypiDependencyGraph(
    root,
    manifest.sourcePath,
    manifest.sourceKind,
    manifest.venvPath,
  );
}

export function findAnyManifest(cwd = process.cwd()): string | undefined {
  try {
    return discoverManifest(cwd).sourcePath;
  } catch {
    return (
      findNpmLockfile(cwd) ||
      findPnpmLockfile(cwd) ||
      findYarnLockfile(cwd) ||
      findPoetryLock(cwd) ||
      findUvLock(cwd) ||
      findRequirementsTxt(cwd)
    );
  }
}

export function projectRootFromManifest(manifestPath: string): string {
  return dirname(resolve(manifestPath));
}
