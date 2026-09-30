import { basename, resolve } from "node:path";
import { existsSync } from "node:fs";
import { findNpmLockfile } from "./npm-lockfile.js";
import { findPnpmLockfile } from "./pnpm-lockfile.js";
import {
  findPoetryLock,
  findRequirementsTxt,
  findUvLock,
  findVenvRoot,
} from "./pypi.js";
import { findYarnLockfile } from "./yarn-lockfile.js";
import type { PackageManager } from "./types.js";

export type ManifestSourceKind =
  | "package-lock.json"
  | "pnpm-lock.yaml"
  | "yarn.lock"
  | "poetry.lock"
  | "uv.lock"
  | "requirements.txt"
  | "venv";

export interface DiscoveredManifest {
  packageManager: PackageManager;
  /** Absolute path used as the primary graph source reference */
  sourcePath: string;
  sourceKind: ManifestSourceKind;
  /** Absolute venv root when available (PyPI) */
  venvPath?: string;
}

function classifyExplicitPath(absolute: string): DiscoveredManifest {
  const name = basename(absolute).toLowerCase();

  if (name === "package-lock.json") {
    return {
      packageManager: "npm",
      sourcePath: absolute,
      sourceKind: "package-lock.json",
    };
  }

  if (name === "pnpm-lock.yaml") {
    return {
      packageManager: "pnpm",
      sourcePath: absolute,
      sourceKind: "pnpm-lock.yaml",
    };
  }

  if (name === "yarn.lock") {
    return {
      packageManager: "yarn",
      sourcePath: absolute,
      sourceKind: "yarn.lock",
    };
  }

  if (name === "poetry.lock") {
    return {
      packageManager: "pypi",
      sourcePath: absolute,
      sourceKind: "poetry.lock",
      venvPath: findVenvRoot(resolve(absolute, "..")),
    };
  }

  if (name === "uv.lock") {
    return {
      packageManager: "pypi",
      sourcePath: absolute,
      sourceKind: "uv.lock",
      venvPath: findVenvRoot(resolve(absolute, "..")),
    };
  }

  if (name === "requirements.txt" || name.startsWith("requirements")) {
    return {
      packageManager: "pypi",
      sourcePath: absolute,
      sourceKind: "requirements.txt",
      venvPath: findVenvRoot(resolve(absolute, "..")),
    };
  }

  throw new Error(
    `Unsupported --lockfile target "${absolute}". Expected package-lock.json, pnpm-lock.yaml, yarn.lock, poetry.lock, uv.lock, or requirements.txt.`,
  );
}

/**
 * Discover which dependency ecosystem to analyze for a project root.
 * Prefer explicit path; otherwise JS lockfiles (npm → pnpm → yarn); then PyPI.
 */
export function discoverManifest(
  cwd = process.cwd(),
  explicitSource?: string,
): DiscoveredManifest {
  if (explicitSource) {
    const absolute = resolve(cwd, explicitSource);
    if (!existsSync(absolute)) {
      throw new Error(`Manifest not found: ${absolute}`);
    }
    return classifyExplicitPath(absolute);
  }

  const npmLock = findNpmLockfile(cwd);
  if (npmLock) {
    return {
      packageManager: "npm",
      sourcePath: npmLock,
      sourceKind: "package-lock.json",
    };
  }

  const pnpmLock = findPnpmLockfile(cwd);
  if (pnpmLock) {
    return {
      packageManager: "pnpm",
      sourcePath: pnpmLock,
      sourceKind: "pnpm-lock.yaml",
    };
  }

  const yarnLock = findYarnLockfile(cwd);
  if (yarnLock) {
    return {
      packageManager: "yarn",
      sourcePath: yarnLock,
      sourceKind: "yarn.lock",
    };
  }

  const poetry = findPoetryLock(cwd);
  if (poetry) {
    return {
      packageManager: "pypi",
      sourcePath: poetry,
      sourceKind: "poetry.lock",
      venvPath: findVenvRoot(cwd),
    };
  }

  const uv = findUvLock(cwd);
  if (uv) {
    return {
      packageManager: "pypi",
      sourcePath: uv,
      sourceKind: "uv.lock",
      venvPath: findVenvRoot(cwd),
    };
  }

  const requirements = findRequirementsTxt(cwd);
  const venv = findVenvRoot(cwd);
  if (requirements && venv) {
    return {
      packageManager: "pypi",
      sourcePath: requirements,
      sourceKind: "requirements.txt",
      venvPath: venv,
    };
  }

  if (venv) {
    return {
      packageManager: "pypi",
      sourcePath: venv,
      sourceKind: "venv",
      venvPath: venv,
    };
  }

  if (requirements) {
    throw new Error(
      [
        "Found requirements.txt but no local virtualenv (.venv/venv).",
        "License Advisor needs an installed environment to resolve transitive deps and METADATA licenses for PyPI projects without poetry.lock/uv.lock.",
        "Create/activate a venv and pip install -r requirements.txt, or pass a poetry.lock / uv.lock via --lockfile.",
      ].join(" "),
    );
  }

  throw new Error(
    [
      "No supported dependency manifest found.",
      "Looked for: package-lock.json, pnpm-lock.yaml, yarn.lock (v1), poetry.lock, uv.lock, requirements.txt + .venv/venv.",
      "Run from the project root or pass --lockfile <path>.",
    ].join(" "),
  );
}
