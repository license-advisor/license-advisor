import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildDefaultContext,
  loadProjectContext,
  patchProjectContext,
  validateProjectContext,
  writeProjectContext,
} from "../src/context.js";
import { saasAgplFixture } from "./helpers.js";

const examplesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../examples",
);

describe("project-context validation", () => {
  it("accepts example SaaS context", () => {
    const result = loadProjectContext(
      examplesDir,
      join(examplesDir, "project-context.saas.yaml"),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.context.project.delivery, "hosted_saas");
    assert.equal(result.context.project.network_access, true);
  });

  it("accepts fixture SaaS context", () => {
    const fixture = saasAgplFixture();
    const result = loadProjectContext(fixture.dir, fixture.contextPath);
    assert.equal(result.ok, true);
  });

  it("rejects missing required fields", () => {
    const result = validateProjectContext(
      {
        schema_version: "0.1.0",
        project: {
          delivery: "hosted_saas",
        },
      },
      "memory",
    );
    assert.equal(result.ok, false);
  });

  it("rejects unknown delivery values", () => {
    const base = buildDefaultContext("x");
    const result = validateProjectContext(
      {
        ...base,
        project: {
          ...base.project,
          delivery: "spaceship" as never,
        },
      },
      "memory",
    );
    assert.equal(result.ok, false);
  });

  it("patches context without wiping unrelated fields", () => {
    const dir = mkdtempSync(join(tmpdir(), "license-advisor-context-"));
    try {
      const file = join(dir, "project-context.yaml");
      writeProjectContext(file, buildDefaultContext("patch-me"), {
        force: true,
      });

      const patched = patchProjectContext(dir, {
        project: {
          commercial: "yes",
          source_visibility: "closed",
        },
      });

      assert.equal(patched.ok, true);
      if (!patched.ok) return;
      assert.equal(patched.context.project.commercial, "yes");
      assert.equal(patched.context.project.source_visibility, "closed");
      assert.equal(patched.context.project.delivery, "hosted_saas");
      assert.equal(patched.context.project.name, "patch-me");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
