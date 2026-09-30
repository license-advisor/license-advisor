import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDependencyGraphFromLockfile } from "./npm-lockfile.js";

const here = dirname(fileURLToPath(import.meta.url));
const lockfile = join(here, "../../fixtures/npm/package-lock.json");

const graph = buildDependencyGraphFromLockfile(lockfile);

assert.equal(graph.rootName, "fixture-app");
assert.equal(graph.lockfileVersion, 3);
assert.equal(graph.stats.direct, 3);
assert.ok(graph.stats.transitive >= 5);

const express = graph.nodes.find((n) => n.name === "express");
assert.ok(express);
assert.equal(express.relationship, "direct");
assert.ok(express.scopes.includes("production"));
assert.equal(express.license, "MIT");
assert.deepEqual(express.path, ["fixture-app", "express"]);

const mimeDb = graph.nodes.find((n) => n.name === "mime-db");
assert.ok(mimeDb);
assert.equal(mimeDb.relationship, "transitive");
assert.ok(mimeDb.path.includes("express"));
assert.ok(mimeDb.path.includes("mime-db"));

const leftPad = graph.nodes.find((n) => n.name === "left-pad");
assert.ok(leftPad);
assert.equal(leftPad.relationship, "direct");
assert.ok(leftPad.scopes.includes("development"));

const ms = graph.nodes.find((n) => n.name === "ms");
assert.ok(ms);
assert.deepEqual(ms.path.slice(0, 3), ["fixture-app", "express", "debug"]);

console.log("graph fixture checks passed");
console.log(
  JSON.stringify(
    {
      stats: graph.stats,
      samplePaths: graph.nodes
        .filter((n) => ["express", "mime-db", "ms", "left-pad"].includes(n.name))
        .map((n) => ({
          name: n.name,
          relationship: n.relationship,
          path: n.path.join(" → "),
        })),
    },
    null,
    2,
  ),
);
