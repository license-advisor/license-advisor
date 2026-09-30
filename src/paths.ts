import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the repository root whether running from src/ (tsx) or dist/ (tsc).
 */
export function resolvePackageRoot(): string {
  const candidates = [
    join(moduleDir, ".."),
    join(moduleDir, "../.."),
  ];

  for (const candidate of candidates) {
    if (
      existsSync(join(candidate, "package.json")) &&
      existsSync(join(candidate, "schemas", "project-context.schema.json"))
    ) {
      return candidate;
    }
  }

  throw new Error(
    "Could not locate package root (expected package.json + schemas/).",
  );
}

export function resolveSchemaPath(
  schemaFile = "project-context.schema.json",
): string {
  return join(resolvePackageRoot(), "schemas", schemaFile);
}
