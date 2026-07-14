import { readFile, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const hostIds = new Set(["browser", "server"]);
const packKeys = new Set(["hosts", "id", "plugins", "schemaVersion"]);
const pluginKeys = new Set(["apiVersion", "entry", "id", "schemaVersion"]);
const pluginIdPattern = /^[A-Za-z][A-Za-z0-9.-]*$/;
const importSpecifierPattern =
  /(?:^|[\r\n])\s*(?:import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|export\s+(?:\{[\s\S]*?\}|\*)\s+from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\))/g;

export async function validateBuiltPluginPack(packId, requiredHost) {
  const packageRoot = await realpath(resolve("dist/plugin-packages", packId));
  const packFilename = resolve(packageRoot, "pack.json");
  const pack = await readJson(packFilename);
  validatePackManifest(pack, packId, requiredHost);

  for (const pluginReference of pack.plugins) {
    const manifestFilename = await resolveContainedFile(
      pluginReference,
      packFilename,
      packageRoot,
      `Plugin manifest in ${packId}`,
    );
    const manifest = await readJson(manifestFilename);
    validatePluginManifest(manifest, manifestFilename);
    await resolveContainedFile(
      manifest.entry,
      manifestFilename,
      dirname(manifestFilename),
      `Plugin module for ${manifest.id}`,
    );
  }

  await assertPackModulesAreSelfContained(packageRoot, packageRoot);
  return packageRoot;
}

async function assertPackModulesAreSelfContained(directory, packageRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const filename = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await assertPackModulesAreSelfContained(filename, packageRoot);
      } else if (entry.name.endsWith(".js")) {
        await assertSelfContainedModule(filename, packageRoot);
      }
    }),
  );
}

async function assertSelfContainedModule(filename, packageRoot) {
  const source = await readFile(filename, "utf8");
  importSpecifierPattern.lastIndex = 0;
  let match;
  while ((match = importSpecifierPattern.exec(source))) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier.startsWith(".")) {
      throw new Error(
        `External plugin artifact contains a non-relative import: ${specifier}`,
      );
    }
    await resolveContainedFile(
      specifier,
      filename,
      packageRoot,
      "External plugin module import",
    );
  }
}

function validatePackManifest(value, expectedId, requiredHost) {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, packKeys) ||
    value.schemaVersion !== 2 ||
    value.id !== expectedId ||
    !Array.isArray(value.hosts) ||
    value.hosts.length === 0 ||
    !value.hosts.every((host) => hostIds.has(host)) ||
    new Set(value.hosts).size !== value.hosts.length ||
    !value.hosts.includes(requiredHost) ||
    !Array.isArray(value.plugins) ||
    value.plugins.length === 0 ||
    !value.plugins.every(
      (manifest) => typeof manifest === "string" && manifest.length > 0,
    ) ||
    new Set(value.plugins).size !== value.plugins.length
  ) {
    throw new Error(
      `Invalid ${requiredHost} plugin pack manifest: ${expectedId}`,
    );
  }
}

function validatePluginManifest(value, filename) {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, pluginKeys) ||
    value.schemaVersion !== 2 ||
    typeof value.apiVersion !== "number" ||
    typeof value.entry !== "string" ||
    value.entry.length === 0 ||
    typeof value.id !== "string" ||
    !pluginIdPattern.test(value.id)
  ) {
    throw new Error(`Invalid built plugin manifest: ${filename}`);
  }
}

async function resolveContainedFile(
  reference,
  fromFilename,
  containmentRoot,
  kind,
) {
  const filename = await realpath(resolve(dirname(fromFilename), reference));
  const relativeFilename = relative(containmentRoot, filename);
  if (
    relativeFilename === ".." ||
    relativeFilename.startsWith("../") ||
    relativeFilename.startsWith("..\\") ||
    isAbsolute(relativeFilename)
  ) {
    throw new Error(`${kind} escapes its package boundary: ${reference}`);
  }
  return filename;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
