#!/usr/bin/env node

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const IMPORT_RE =
  /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|\bexport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

const repoRoot = process.cwd();

if (process.argv.includes("--self-test")) {
  await runSelfTest();
} else {
  const errors = await checkWorkspace(repoRoot);
  report(errors);
}

async function checkWorkspace(root) {
  const packages = await loadWorkspacePackages(root);
  const packageByRoot = new Map(packages.map((pkg) => [pkg.root, pkg]));
  const packageByName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const packageNames = [...packageByName.keys()].sort(
    (a, b) => b.length - a.length,
  );
  const errors = [];

  for (const pkg of packages) {
    const files = await collectFiles(path.join(pkg.root, "src"));

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const specifiers = collectImportSpecifiers(source);

      for (const specifier of specifiers) {
        if (specifier.startsWith(".")) {
          const target = path.normalize(
            path.resolve(path.dirname(file), specifier),
          );
          if (!isInsidePackage(target, pkg.root)) {
            errors.push({
              file,
              message: `relative import escapes package: ${specifier}`,
            });
          }
          continue;
        }

        if (specifier.startsWith("node:")) {
          continue;
        }

        const importedPackage = findWorkspacePackage(specifier, packageNames);
        if (!importedPackage) {
          continue;
        }

        if (importedPackage === pkg.name) {
          validatePackageExport({
            errors,
            file,
            importedPackage,
            packageByName,
            specifier,
          });
          continue;
        }

        if (!isDeclaredDependency(pkg, importedPackage)) {
          errors.push({
            file,
            message: `${pkg.name} imports ${importedPackage}, but it is not a declared dependency`,
          });
        }

        validatePackageExport({
          errors,
          file,
          importedPackage,
          packageByName,
          specifier,
        });
      }
    }
  }

  return errors.map((error) => ({
    ...error,
    file: path.relative(root, error.file),
  }));
}

async function loadWorkspacePackages(root) {
  const rootPackage = readJson(path.join(root, "package.json"));
  const workspacePatterns = rootPackage.workspaces ?? [];
  const packages = [];

  for (const pattern of workspacePatterns) {
    if (pattern !== "packages/*") {
      throw new Error(`Unsupported workspace pattern: ${pattern}`);
    }

    const workspaceRoot = path.join(root, "packages");
    const entries = await readdir(workspaceRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageRoot = path.join(workspaceRoot, entry.name);
      const manifestPath = path.join(packageRoot, "package.json");
      const manifest = readJson(manifestPath);
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

  return packages;
}

async function collectFiles(root) {
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
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (sourceExtensions.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  await visit(root);
  return files;
}

function collectImportSpecifiers(source) {
  const specifiers = [];
  let match;
  IMPORT_RE.lastIndex = 0;

  while ((match = IMPORT_RE.exec(source))) {
    specifiers.push(match[1] ?? match[2] ?? match[3]);
  }

  return specifiers;
}

function findWorkspacePackage(specifier, packageNames) {
  return packageNames.find(
    (packageName) =>
      specifier === packageName || specifier.startsWith(`${packageName}/`),
  );
}

function isDeclaredDependency(pkg, importedPackage) {
  return Object.hasOwn(pkg.dependencies, importedPackage);
}

function validatePackageExport({
  errors,
  file,
  importedPackage,
  packageByName,
  specifier,
}) {
  const imported = packageByName.get(importedPackage);
  const subpath =
    specifier === importedPackage
      ? "."
      : `.${specifier.slice(importedPackage.length)}`;

  if (!Object.hasOwn(imported.exports, subpath)) {
    errors.push({
      file,
      message: `${specifier} is not exported by ${importedPackage}`,
    });
  }
}

function isInsidePackage(target, packageRoot) {
  const relative = path.relative(packageRoot, target);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function report(errors) {
  if (errors.length === 0) {
    console.log("Package boundaries OK");
    return;
  }

  console.error("Package boundary violations:");
  for (const error of errors) {
    console.error(`- ${error.file}: ${error.message}`);
  }
  process.exitCode = 1;
}

async function runSelfTest() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "solitude-boundaries-"));

  try {
    writeFileSync(
      path.join(tempRoot, "package.json"),
      JSON.stringify(
        {
          private: true,
          type: "module",
          workspaces: ["packages/*"],
        },
        null,
        2,
      ),
    );
    writePackageFixture(tempRoot, "engine", "@fixture/engine", {
      exports: { "./public": "./src/public.ts" },
    });
    writePackageFixture(tempRoot, "browser", "@fixture/browser", {
      dependencies: { "@fixture/engine": "0.0.0" },
      exports: { "./public": "./src/public.ts" },
    });
    writePackageFixture(tempRoot, "app", "fixture-app", {
      dependencies: {
        "@fixture/browser": "0.0.0",
        "@fixture/engine": "0.0.0",
      },
      exports: { "./public": "./src/public.ts" },
    });

    const browserSource = path.join(tempRoot, "packages/browser/src/public.ts");
    writeFileSync(
      browserSource,
      'import { value } from "@fixture/engine/public";\nexport const browserValue = value;\n',
    );

    const ok = await checkWorkspace(tempRoot);
    assertNoErrors(ok, "expected valid fixture imports to pass");

    writeFileSync(
      browserSource,
      'import { value } from "@fixture/engine/internal";\nexport const browserValue = value;\n',
    );
    assertHasError(
      await checkWorkspace(tempRoot),
      "not exported",
      "expected unexported package imports to fail",
    );

    writeFileSync(
      browserSource,
      'import { value } from "../../engine/src/public";\nexport const browserValue = value;\n',
    );
    assertHasError(
      await checkWorkspace(tempRoot),
      "relative import escapes package",
      "expected cross-package relative imports to fail",
    );

    writeFileSync(
      path.join(tempRoot, "packages/engine/src/public.ts"),
      'import { browserValue } from "@fixture/browser/public";\nexport const value = browserValue;\n',
    );
    writeFileSync(browserSource, "export const browserValue = 1;\n");
    assertHasError(
      await checkWorkspace(tempRoot),
      "not a declared dependency",
      "expected reverse package dependencies to fail",
    );

    console.log("Package boundary self-test OK");
  } finally {
    rmSync(tempRoot, { force: true, recursive: true });
  }
}

function writePackageFixture(root, directory, name, manifestFields) {
  const packageRoot = path.join(root, "packages", directory);
  const srcRoot = path.join(packageRoot, "src");

  mkdirSync(srcRoot, { recursive: true });
  writeFileSync(
    path.join(packageRoot, "package.json"),
    JSON.stringify(
      {
        name,
        private: true,
        type: "module",
        version: "0.0.0",
        ...manifestFields,
      },
      null,
      2,
    ),
  );
  writeFileSync(path.join(srcRoot, "public.ts"), "export const value = 1;\n");
}

function assertNoErrors(errors, message) {
  if (errors.length > 0) {
    throw new Error(`${message}: ${JSON.stringify(errors)}`);
  }
}

function assertHasError(errors, text, message) {
  if (!errors.some((error) => error.message.includes(text))) {
    throw new Error(`${message}: ${JSON.stringify(errors)}`);
  }
}
