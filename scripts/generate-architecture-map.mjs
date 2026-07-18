#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Project, SyntaxKind } from "ts-morph";

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, "docs", "architecture-map");
const outFile = path.join(outDir, "architecture.json");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const sourceExcludes = [
  /(^|\/)__tests__(\/|$)/,
  /\.test\.[cm]?[tj]sx?$/,
  /\.d\.ts$/,
  /(^|\/)vite-env\.d\.ts$/,
];

const nodes = new Map();
const edges = new Map();

const packages = await loadWorkspacePackages(repoRoot);
const packageByName = new Map(packages.map((pkg) => [pkg.name, pkg]));
const packageNames = [...packageByName.keys()].sort(
  (a, b) => b.length - a.length,
);

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

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  tsConfigFilePath: path.join(repoRoot, "tsconfig.json"),
});

const sourceFileByPath = new Map();
const moduleBySourceFilePath = new Map();
const publicSymbolByDeclarationKey = new Map();

for (const pkg of packages) {
  pkg.files = await collectSourceFiles(path.join(pkg.root, "src"));

  for (const filePath of pkg.files) {
    const sourceFile = project.addSourceFileAtPath(filePath);
    sourceFileByPath.set(normalizePath(filePath), sourceFile);
  }
}

for (const pkg of packages) {
  const exportEntries = Object.entries(pkg.exports).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [subpath, targetValue] of exportEntries) {
    const target = exportTargetToPath(targetValue);
    if (!target) {
      continue;
    }

    const targetPath = normalizePath(path.resolve(pkg.root, target));
    const sourceFile = sourceFileByPath.get(targetPath);
    if (!sourceFile) {
      continue;
    }

    const moduleId = moduleNodeId(pkg.name, subpath);
    moduleBySourceFilePath.set(targetPath, moduleId);
    addNode({
      id: moduleId,
      kind: "module",
      label: subpath,
      packageName: pkg.name,
      parent: packageNodeId(pkg.name),
    });

    const declarations = sourceFile.getExportedDeclarations();
    const names = [...declarations.keys()].sort();

    for (const name of names) {
      if (name === "default") {
        continue;
      }

      const declarationList = declarations.get(name) ?? [];
      const declaration = firstSourceDeclaration(declarationList);
      const symbolId = publicSymbolNodeId(pkg.name, subpath, name);
      const symbolKind = declaration ? declarationKind(declaration) : "export";

      addNode({
        id: symbolId,
        kind: "symbol",
        label: name,
        packageName: pkg.name,
        parent: moduleId,
        symbolKind,
      });

      if (declaration) {
        const declarationPath = normalizePath(
          declaration.getSourceFile().getFilePath(),
        );
        addPublicSymbolDeclaration({
          declarationPath,
          name,
          symbolId,
        });
      }
    }
  }
}

for (const pkg of packages) {
  const exportEntries = Object.entries(pkg.exports).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [subpath, targetValue] of exportEntries) {
    const target = exportTargetToPath(targetValue);
    if (!target) {
      continue;
    }

    const targetPath = normalizePath(path.resolve(pkg.root, target));
    const sourceFile = sourceFileByPath.get(targetPath);
    const sourceModuleId = moduleNodeId(pkg.name, subpath);
    if (!sourceFile || !nodes.has(sourceModuleId)) {
      continue;
    }

    collectModuleImportEdges({
      sourceFile,
      sourceModuleId,
    });
  }
}

for (const pkg of packages) {
  const exportEntries = Object.entries(pkg.exports).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [subpath, targetValue] of exportEntries) {
    const target = exportTargetToPath(targetValue);
    if (!target) {
      continue;
    }

    const targetPath = normalizePath(path.resolve(pkg.root, target));
    const sourceFile = sourceFileByPath.get(targetPath);
    if (!sourceFile) {
      continue;
    }

    const declarations = sourceFile.getExportedDeclarations();

    for (const [name, declarationList] of declarations) {
      if (name === "default") {
        continue;
      }

      const sourceSymbolId = publicSymbolNodeId(pkg.name, subpath, name);
      if (!nodes.has(sourceSymbolId)) {
        continue;
      }

      const declaration = firstSourceDeclaration(declarationList);
      if (!declaration) {
        continue;
      }

      for (const targetSymbolId of collectReferencedPublicSymbols({
        declaration,
        sourcePackageName: pkg.name,
        sourceSymbolId,
      })) {
        addEdge({
          from: sourceSymbolId,
          kind: "symbol-reference",
          to: targetSymbolId,
        });
      }
    }
  }
}

const architecture = {
  generatedAt: new Date().toISOString(),
  generator: "scripts/generate-architecture-map.mjs",
  notes: [
    "Package dependencies come from workspace package manifests.",
    "Module nodes come from package exports.",
    "Public symbol nodes are restricted to symbols reachable through package exports.",
    "Module import edges come from TypeScript imports in exported module entry files.",
    "Symbol reference edges come from TypeScript references that resolve to public symbols.",
    "Source files are read for TypeScript symbol analysis, but physical folders and files are not emitted.",
  ],
  repoRoot: path.basename(repoRoot),
  toolchain: {
    dependencyCruiser: "installed for future alternate import graph exports",
    tsMorph: "used for TypeScript symbol and import analysis",
    typedoc: "installed for future API documentation exports",
  },
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
        exports: manifest.exports ?? {},
        manifest,
        name: manifest.name,
        root: packageRoot,
      });
    }
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

async function collectSourceFiles(root) {
  const files = [];

  async function visit(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = normalizePath(path.relative(repoRoot, fullPath));

      if (entry.isDirectory()) {
        if (entry.name === "node_modules") {
          continue;
        }
        await visit(fullPath);
        continue;
      }

      if (!sourceExtensions.has(path.extname(entry.name))) {
        continue;
      }

      if (sourceExcludes.some((exclude) => exclude.test(relativePath))) {
        continue;
      }

      files.push(fullPath);
    }
  }

  await visit(root);
  return files.sort();
}

function collectModuleImportEdges({ sourceFile, sourceModuleId }) {
  for (const moduleSpecifier of sourceFile.getDescendantsOfKind(
    SyntaxKind.StringLiteral,
  )) {
    const parentKind = moduleSpecifier.getParent().getKind();
    if (
      parentKind !== SyntaxKind.ImportDeclaration &&
      parentKind !== SyntaxKind.ExportDeclaration
    ) {
      continue;
    }

    const targetModuleId = resolveModuleSpecifierToModuleId({
      sourceFile,
      specifier: moduleSpecifier.getLiteralText(),
    });
    if (!targetModuleId) {
      continue;
    }

    addEdge({
      from: sourceModuleId,
      kind: "module-import",
      to: targetModuleId,
    });
  }
}

function resolveModuleSpecifierToModuleId({ sourceFile, specifier }) {
  if (specifier.startsWith(".")) {
    const targetPath = resolveSourcePath(
      path.resolve(path.dirname(sourceFile.getFilePath()), specifier),
    );
    return targetPath ? moduleBySourceFilePath.get(targetPath) : undefined;
  }

  if (specifier.startsWith("node:")) {
    return undefined;
  }

  const packageName = findWorkspacePackage(specifier);
  if (!packageName) {
    return undefined;
  }

  const importedPackage = packageByName.get(packageName);
  const subpath =
    specifier === packageName ? "." : `.${specifier.slice(packageName.length)}`;

  if (!Object.hasOwn(importedPackage.exports, subpath)) {
    return undefined;
  }

  return moduleNodeId(packageName, subpath);
}

function resolveSourcePath(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ];

  for (const candidate of candidates) {
    const normalized = normalizePath(candidate);
    if (sourceFileByPath.has(normalized)) {
      return normalized;
    }
  }

  return undefined;
}

function collectReferencedPublicSymbols({
  declaration,
  sourcePackageName,
  sourceSymbolId,
}) {
  const references = new Set();

  for (const identifier of declaration.getDescendantsOfKind(
    SyntaxKind.Identifier,
  )) {
    for (const definition of identifier.getDefinitions()) {
      const definitionPath = normalizePath(
        definition.getSourceFile().getFilePath(),
      );
      const targetSymbolIds =
        publicSymbolByDeclarationKey.get(
          publicSymbolDeclarationKey({
            declarationPath: definitionPath,
            name: definition.getName(),
          }),
        ) ?? [];
      const preferredTargetSymbolIds = preferSamePackageSymbols(
        targetSymbolIds,
        sourcePackageName,
      );

      for (const targetSymbolId of preferredTargetSymbolIds) {
        if (targetSymbolId !== sourceSymbolId) {
          references.add(targetSymbolId);
        }
      }
    }
  }

  return references;
}

function preferSamePackageSymbols(symbolIds, packageName) {
  const samePackageSymbolIds = symbolIds.filter(
    (symbolId) => symbolPackageName(symbolId) === packageName,
  );
  if (samePackageSymbolIds.length > 0) {
    return samePackageSymbolIds;
  }

  const sourcePackage = packageByName.get(packageName);
  const dependencySymbolIds = symbolIds.filter((symbolId) =>
    Object.hasOwn(
      sourcePackage?.dependencies ?? {},
      symbolPackageName(symbolId) ?? "",
    ),
  );
  return dependencySymbolIds.length > 0 ? dependencySymbolIds : symbolIds;
}

function symbolPackageName(symbolId) {
  const match = /^symbol:([^:]+):/.exec(symbolId);
  return match?.[1];
}

function addPublicSymbolDeclaration({ declarationPath, name, symbolId }) {
  const key = publicSymbolDeclarationKey({ declarationPath, name });
  const symbolIds = publicSymbolByDeclarationKey.get(key) ?? [];
  symbolIds.push(symbolId);
  publicSymbolByDeclarationKey.set(key, symbolIds);
}

function publicSymbolDeclarationKey({ declarationPath, name }) {
  return `${declarationPath}:${name}`;
}

function firstSourceDeclaration(declarations) {
  return declarations.find((declaration) => {
    const filePath = normalizePath(declaration.getSourceFile().getFilePath());
    return filePath.startsWith(normalizePath(repoRoot));
  });
}

function declarationKind(declaration) {
  if (declaration.isKind(SyntaxKind.InterfaceDeclaration)) {
    return "interface";
  }
  if (declaration.isKind(SyntaxKind.TypeAliasDeclaration)) {
    return "type";
  }
  if (declaration.isKind(SyntaxKind.FunctionDeclaration)) {
    return "function";
  }
  if (declaration.isKind(SyntaxKind.ClassDeclaration)) {
    return "class";
  }
  if (declaration.isKind(SyntaxKind.EnumDeclaration)) {
    return "enum";
  }
  if (declaration.isKind(SyntaxKind.VariableDeclaration)) {
    return "const";
  }
  return declaration.getKindName();
}

function exportTargetToPath(value) {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    return value.import ?? value.default ?? value.types;
  }

  return undefined;
}

function findWorkspacePackage(specifier) {
  return packageNames.find(
    (packageName) =>
      specifier === packageName || specifier.startsWith(`${packageName}/`),
  );
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

function normalizePath(value) {
  return value.replaceAll(path.sep, "/");
}

function packageNodeId(packageName) {
  return `pkg:${packageName}`;
}

function moduleNodeId(packageName, subpath) {
  return `module:${packageName}:${subpath}`;
}

function publicSymbolNodeId(packageName, subpath, name) {
  return `symbol:${packageName}:${subpath}:${name}`;
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
