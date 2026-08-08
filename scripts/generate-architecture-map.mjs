#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, "docs", "architecture-map");
const outFile = path.join(outDir, "architecture.json");

const nodes = new Map();
const edges = new Map();

const packages = await loadWorkspacePackages(repoRoot);
const packageByName = new Map(packages.map((pkg) => [pkg.name, pkg]));

for (const pkg of packages) {
  addNode({
    id: packageNodeId(pkg.name),
    kind: "package",
    label: pkg.name,
    packageName: pkg.name,
  });

  for (const depName of Object.keys(pkg.dependencies).sort()) {
    if (!packageByName.has(depName)) {
      continue;
    }

    addEdge({
      from: packageNodeId(pkg.name),
      kind: "dependency",
      to: packageNodeId(depName),
    });
  }
}

const architecture = {
  generatedAt: new Date().toISOString(),
  generator: "scripts/generate-architecture-map.mjs",
  notes: ["Package dependencies come from workspace package manifests."],
  repoRoot: path.basename(repoRoot),
  nodes: [...nodes.values()].sort(compareNodes),
  edges: [...edges.values()].sort(compareEdges),
};

await mkdir(outDir, { recursive: true });
await writeFile(outFile, `${JSON.stringify(architecture, null, 2)}\n`);

console.log(
  `Wrote ${path.relative(repoRoot, outFile)} with ${architecture.nodes.length} nodes and ${architecture.edges.length} edges.`,
);

async function loadWorkspacePackages(root) {
  const rootPackage = await readJson(path.join(root, "package.json"));
  const packages = [];

  for (const pattern of rootPackage.workspaces ?? []) {
    const patternMatch = /^([^*]+)\/\*$/.exec(pattern);
    if (!patternMatch) {
      throw new Error(`Unsupported workspace pattern: ${pattern}`);
    }

    const workspaceRoot = path.join(root, patternMatch[1]);
    const entries = await readdir(workspaceRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageRoot = path.join(workspaceRoot, entry.name);
      const manifest = await readJson(path.join(packageRoot, "package.json"));
      packages.push({
        dependencies: {
          ...(manifest.dependencies ?? {}),
          ...(manifest.peerDependencies ?? {}),
        },
        name: manifest.name,
      });
    }
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

function addNode(node) {
  nodes.set(node.id, node);
}

function addEdge(edge) {
  if (edge.from === edge.to) {
    return;
  }

  const id = `${edge.kind}:${edge.from}->${edge.to}`;
  edges.set(id, { id, ...edge });
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function packageNodeId(packageName) {
  return `pkg:${packageName}`;
}

function compareNodes(a, b) {
  return `${a.kind}:${a.label}:${a.id}`.localeCompare(
    `${b.kind}:${b.label}:${b.id}`,
  );
}

function compareEdges(a, b) {
  return `${a.kind}:${a.from}:${a.to}`.localeCompare(
    `${b.kind}:${b.from}:${b.to}`,
  );
}
