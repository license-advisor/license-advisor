#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  COMMERCIAL_OPTIONS,
  CUSTOMER_DISTRIBUTION,
  DELIVERY_MODES,
  LINKING_MODELS,
  MODIFIES_DEPENDENCIES,
  SOURCE_VISIBILITY,
} from "../types.js";
import {
  handleCheckDependency,
  handleExplainFinding,
  handleGetDependencyPath,
  handleGetProjectContext,
  handleListOutcomes,
  handleScanProject,
  handleUpdateProjectContext,
} from "./tools.js";

const projectRootField = z
  .string()
  .optional()
  .describe(
    "Absolute path to the target project root. Defaults to LICENSE_ADVISOR_ROOT or the MCP process cwd.",
  );

export function createLicenseAdvisorServer(): McpServer {
  const server = new McpServer({
    name: "license-advisor",
    version: "0.0.1",
  });

  server.registerTool(
    "scan_project",
    {
      title: "Scan project licenses",
      description:
        "Scan npm or PyPI dependencies against the project's declared shipping intent (project-context). Returns deterministic findings with evidence and assumptions. Alerts only - not legal advice. Do not invent package alternatives or license tables outside this tool's findings.",
      inputSchema: {
        project_root: projectRootField,
        context_path: z
          .string()
          .optional()
          .describe("Optional path to project-context.yaml"),
        lockfile_path: z
          .string()
          .optional()
          .describe(
            "Optional manifest path: package-lock.json, poetry.lock, uv.lock, or requirements.txt",
          ),
        include_draft_rules: z
          .boolean()
          .optional()
          .describe("Include draft rules (default false)"),
      },
    },
    async (args) => handleScanProject(args),
  );

  server.registerTool(
    "explain_finding",
    {
      title: "Explain a finding",
      description:
        "Return a calm, evidence-backed explanation for a finding id or package name from the latest deterministic scan. Present assumptions and limits. Do not invent legal conclusions.",
      inputSchema: {
        project_root: projectRootField,
        context_path: z.string().optional(),
        lockfile_path: z.string().optional(),
        finding_id: z.string().optional().describe("e.g. finding-001"),
        package_name: z
          .string()
          .optional()
          .describe("Package name to explain, e.g. agpl-lib"),
      },
    },
    async (args) => handleExplainFinding(args),
  );

  server.registerTool(
    "check_dependency",
    {
      title: "Check one dependency",
      description:
        "Check license resolution and policy findings for a single dependency under the current project-context.",
      inputSchema: {
        project_root: projectRootField,
        context_path: z.string().optional(),
        lockfile_path: z.string().optional(),
        package_name: z.string().describe("Package name to check"),
      },
    },
    async (args) => handleCheckDependency(args),
  );

  server.registerTool(
    "get_dependency_path",
    {
      title: "Get dependency path",
      description:
        "Show how a package enters the dependency graph (direct/transitive path).",
      inputSchema: {
        project_root: projectRootField,
        lockfile_path: z.string().optional(),
        package_name: z.string(),
      },
    },
    async (args) => handleGetDependencyPath(args),
  );

  server.registerTool(
    "get_project_context",
    {
      title: "Get project context",
      description:
        "Read the declared shipping/commercialization intent used by the policy engine.",
      inputSchema: {
        project_root: projectRootField,
        context_path: z.string().optional(),
      },
    },
    async (args) => handleGetProjectContext(args),
  );

  server.registerTool(
    "update_project_context",
    {
      title: "Update project context",
      description:
        "Update shipping intent fields in project-context.yaml. Wrong intent produces wrong alerts. After updating, re-run scan_project.",
      inputSchema: {
        project_root: projectRootField,
        context_path: z.string().optional(),
        create_if_missing: z
          .boolean()
          .optional()
          .describe("Create a default context file if missing"),
        notes: z.string().optional(),
        name: z.string().optional(),
        delivery: z.enum(DELIVERY_MODES).optional(),
        commercial: z.enum(COMMERCIAL_OPTIONS).optional(),
        source_visibility: z.enum(SOURCE_VISIBILITY).optional(),
        customer_distribution: z.enum(CUSTOMER_DISTRIBUTION).optional(),
        network_access: z.boolean().optional(),
        modifies_dependencies: z.enum(MODIFIES_DEPENDENCIES).optional(),
        linking_model: z.enum(LINKING_MODELS).optional(),
      },
    },
    async (args) => handleUpdateProjectContext(args),
  );

  server.registerTool(
    "list_outcomes",
    {
      title: "List outcome taxonomy",
      description:
        "List the deterministic alert outcomes used by license-advisor.",
      inputSchema: {},
    },
    async () => handleListOutcomes(),
  );

  return server;
}

async function main(): Promise<void> {
  const server = createLicenseAdvisorServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
