export type DependencyScope =
  | "production"
  | "development"
  | "optional"
  | "peer"
  | "unknown";

export type DependencyRelationship = "direct" | "transitive" | "root";

export interface LockfilePackage {
  /** Lockfile packages key, e.g. "" or "node_modules/express" */
  lockfileKey: string;
  name: string;
  version: string;
  license?: string;
  /** Declared dependency name → version range */
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  /** How this package is linked from its parent declaration scopes */
  scopes: DependencyScope[];
  isDev: boolean;
  isOptional: boolean;
  link?: boolean;
  resolved?: string;
}

export interface DependencyEdge {
  from: string; // package name or "(root)"
  to: string; // package name
  range?: string;
  scope: DependencyScope;
}

export interface DependencyNode {
  name: string;
  version: string;
  lockfileKey: string;
  relationship: DependencyRelationship;
  scopes: DependencyScope[];
  license?: string;
  /** One representative path from root, package names only */
  path: string[];
  /** Immediate parents (package names) */
  introducedBy: string[];
  dependencyCount: number;
}

export type PackageManager = "npm" | "pnpm" | "yarn" | "pypi";

export interface DependencyGraph {
  rootName: string;
  rootVersion: string;
  /** Primary manifest path (lockfile, requirements.txt, or venv root) */
  lockfilePath: string;
  lockfileVersion: number;
  packageManager: PackageManager;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  stats: {
    total: number;
    direct: number;
    transitive: number;
    production: number;
    development: number;
    withLicenseField: number;
  };
}
