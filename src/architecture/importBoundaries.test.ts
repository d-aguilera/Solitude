import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(repoRoot, "src");
const packageRoot = join(repoRoot, "packages");

const pluginsRoots = [
  join(srcRoot, "plugins"),
  join(packageRoot, "solitude/src/plugins"),
];

const guardedRoots = [
  ...["app", "domain", "infra", "render", "setup"].map((root) =>
    join(srcRoot, root),
  ),
  join(packageRoot, "engine/src"),
  join(packageRoot, "browser/src"),
];

const importSpecifierPattern =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

describe("import boundaries", () => {
  it("keeps generic production source from importing Solitude plugins", () => {
    const violations: string[] = [];

    for (const rootPath of guardedRoots) {
      for (const filePath of collectProductionTypeScriptFiles(rootPath)) {
        violations.push(...findPluginImports(filePath));
      }
    }

    expect(violations).toEqual([]);
  });
});

function collectProductionTypeScriptFiles(rootPath: string): string[] {
  const files: string[] = [];
  collectProductionTypeScriptFilesInto(files, rootPath);
  return files;
}

function collectProductionTypeScriptFilesInto(
  files: string[],
  directoryPath: string,
): void {
  for (const entry of readdirSync(directoryPath)) {
    const entryPath = join(directoryPath, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      if (entry === "__tests__") continue;
      collectProductionTypeScriptFilesInto(files, entryPath);
      continue;
    }

    if (!stats.isFile()) continue;
    if (extname(entryPath) !== ".ts") continue;
    if (entryPath.endsWith(".test.ts") || entryPath.endsWith(".spec.ts")) {
      continue;
    }
    files.push(entryPath);
  }
}

function findPluginImports(filePath: string): string[] {
  const source = readFileSync(filePath, "utf8");
  const violations: string[] = [];

  for (const match of source.matchAll(importSpecifierPattern)) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;
    if (
      specifier === "solitude/plugins" ||
      specifier.startsWith("solitude/plugins/")
    ) {
      const sourcePath = relative(repoRoot, filePath);
      violations.push(`${sourcePath} imports ${specifier}`);
      continue;
    }
    if (!specifier.startsWith(".")) continue;

    const resolvedTarget = resolve(dirname(filePath), specifier);
    if (
      !pluginsRoots.some((pluginsRoot) =>
        isUnderPath(resolvedTarget, pluginsRoot),
      )
    ) {
      continue;
    }

    const sourcePath = relative(repoRoot, filePath);
    const targetPath = relative(repoRoot, resolvedTarget);
    violations.push(`${sourcePath} imports ${targetPath}`);
  }

  return violations;
}

function isUnderPath(path: string, possibleParent: string): boolean {
  const pathToParent = relative(possibleParent, path);
  return pathToParent === "" || !pathToParent.startsWith("..");
}
