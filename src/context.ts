import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import YAML from "yaml";
import type { ErrorObject, ValidateFunction } from "ajv";
import {
  DEFAULT_CONTEXT_FILENAME,
  SCHEMA_VERSION,
  type ProjectContext,
} from "./types.js";
import { resolveSchemaPath } from "./paths.js";

const require = createRequire(import.meta.url);
// ajv / ajv-formats ship as CJS; require keeps NodeNext + tsc happy
const Ajv2020 = require("ajv/dist/2020.js") as new (options?: object) => {
  compile<T>(schema: object): ValidateFunction<T>;
};
const addFormats = require("ajv-formats") as (
  ajv: InstanceType<typeof Ajv2020>,
) => void;

export interface LoadContextResult {
  path: string;
  context: ProjectContext;
}

export interface ValidationFailure {
  ok: false;
  path: string;
  errors: string[];
}

export interface ValidationSuccess {
  ok: true;
  path: string;
  context: ProjectContext;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) {
    return ["Unknown schema validation error."];
  }

  return errors.map((error) => {
    const where = error.instancePath || "(root)";
    const message = error.message ?? "invalid";
    return `${where}: ${message}`;
  });
}

function createValidator() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  addFormats(ajv);

  const schemaPath = resolveSchemaPath("project-context.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
  return ajv.compile<ProjectContext>(schema);
}

const validateContext = createValidator();

export function resolveContextPath(cwd = process.cwd(), explicit?: string): string {
  if (explicit) {
    return resolve(cwd, explicit);
  }
  return resolve(cwd, DEFAULT_CONTEXT_FILENAME);
}

export function readContextFile(filePath: string): unknown {
  if (!existsSync(filePath)) {
    throw new Error(`Project context not found: ${filePath}`);
  }

  const raw = readFileSync(filePath, "utf8");
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".json")) {
    return JSON.parse(raw) as unknown;
  }

  return YAML.parse(raw) as unknown;
}

export function validateProjectContext(
  data: unknown,
  filePath: string,
): ValidationResult {
  const ok = validateContext(data);
  if (!ok) {
    return {
      ok: false,
      path: filePath,
      errors: formatAjvErrors(validateContext.errors),
    };
  }

  return {
    ok: true,
    path: filePath,
    context: data as ProjectContext,
  };
}

export function loadProjectContext(
  cwd = process.cwd(),
  explicitPath?: string,
): ValidationResult {
  const path = resolveContextPath(cwd, explicitPath);
  const data = readContextFile(path);
  return validateProjectContext(data, path);
}

export function buildDefaultContext(name?: string): ProjectContext {
  const now = new Date().toISOString();
  return {
    schema_version: SCHEMA_VERSION,
    meta: {
      created_at: now,
      updated_at: now,
      notes: "Edit this file to match how you intend to ship. Wrong intent → wrong alerts.",
    },
    project: {
      name: name ?? "unnamed-project",
      delivery: "hosted_saas",
      commercial: "undecided",
      audience: "unknown",
      source_visibility: "undecided",
      customer_distribution: "unknown",
      network_access: true,
      modifies_dependencies: "unknown",
      linking_model: "unknown",
      target_platforms: ["web"],
      dependency_scopes_in_scope: ["production"],
    },
    policy: {
      fail_on: ["conflict"],
      warn_on: ["red_flag", "review_required"],
    },
  };
}

export function writeProjectContext(
  filePath: string,
  context: ProjectContext,
  { force = false }: { force?: boolean } = {},
): void {
  if (existsSync(filePath) && !force) {
    throw new Error(
      `Refusing to overwrite existing file: ${filePath} (pass --force to replace)`,
    );
  }

  const yaml = YAML.stringify(context, {
    indent: 2,
    lineWidth: 100,
  });

  writeFileSync(filePath, yaml, "utf8");
}

export function patchProjectContext(
  cwd = process.cwd(),
  patch: {
    path?: string;
    project?: Partial<ProjectContext["project"]>;
    policy?: Partial<NonNullable<ProjectContext["policy"]>>;
    notes?: string;
  },
): ValidationResult & { wrote?: string } {
  const filePath = resolveContextPath(cwd, patch.path);
  const existing = loadProjectContext(cwd, patch.path);
  if (!existing.ok) {
    return existing;
  }

  const projectPatch = Object.fromEntries(
    Object.entries(patch.project ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<ProjectContext["project"]>;

  const policyPatch = Object.fromEntries(
    Object.entries(patch.policy ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<NonNullable<ProjectContext["policy"]>>;

  const next: ProjectContext = {
    ...existing.context,
    meta: {
      ...existing.context.meta,
      updated_at: new Date().toISOString(),
      notes: patch.notes ?? existing.context.meta?.notes,
    },
    project: {
      ...existing.context.project,
      ...projectPatch,
    },
    policy: {
      ...existing.context.policy,
      ...policyPatch,
    },
  };

  const validated = validateProjectContext(next, filePath);
  if (!validated.ok) {
    return validated;
  }

  writeProjectContext(filePath, validated.context, { force: true });
  return { ...validated, wrote: filePath };
}

/** Useful when debugging schema load path in tests. */
export function schemaModuleUrl(): string {
  return pathToFileURL(resolveSchemaPath()).href;
}
