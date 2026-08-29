import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { arch, cpus, hostname, platform, release } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

export async function captureHostEnvironment(root = process.cwd()) {
  const [commit, status] = await Promise.all([
    readGitOutput(root, ["rev-parse", "HEAD"]),
    readGitOutput(root, ["status", "--porcelain"]),
  ]);
  return {
    commit: commit || "unknown",
    cpu: cpus()[0]?.model ?? "unknown",
    dirty: status.length > 0,
    machine: hostname(),
    nodeOptions: process.env.NODE_OPTIONS ?? "",
    nodeVersion: process.version,
    platform: `${platform()} ${release()} ${arch()}`,
  };
}

export async function captureServerMetadata({
  cpuAffinity = "not-pinned",
  machine,
  root = process.cwd(),
}) {
  const serverEntryPath = resolve(root, "dist/server/main.js");
  const pluginRoot = resolve(root, "dist/server/plugins");
  await assertProductionBuildExists(serverEntryPath);
  const [host, pluginIdentity, serverArtifactSha256] = await Promise.all([
    captureHostEnvironment(root),
    readPluginIdentity(pluginRoot),
    hashFile(serverEntryPath),
  ]);
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    commit: host.commit,
    cpu: host.cpu,
    cpuAffinity,
    dirty: host.dirty,
    machine,
    nodeOptions: host.nodeOptions,
    nodeVersion: host.nodeVersion,
    platform: host.platform,
    pluginIdentity,
    serverArtifactSha256,
    serverBuild: "production",
    serverEntry: relative(root, serverEntryPath),
  };
}

export function validateServerMetadata(value, source = "server metadata") {
  if (!value || typeof value !== "object" || value.schemaVersion !== 1) {
    throw new Error(`${source} must be a version-1 server metadata document`);
  }
  for (const field of [
    "capturedAt",
    "commit",
    "cpu",
    "cpuAffinity",
    "machine",
    "nodeVersion",
    "platform",
    "serverArtifactSha256",
    "serverBuild",
    "serverEntry",
  ]) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      throw new Error(`${source}.${field} must be a non-empty string`);
    }
  }
  if (typeof value.nodeOptions !== "string") {
    throw new Error(`${source}.nodeOptions must be a string`);
  }
  if (typeof value.dirty !== "boolean") {
    throw new Error(`${source}.dirty must be a boolean`);
  }
  if (!value.pluginIdentity || typeof value.pluginIdentity !== "object") {
    throw new Error(`${source}.pluginIdentity must be an object`);
  }
  return value;
}

async function readPluginIdentity(pluginRoot) {
  const pluginSetPath = join(pluginRoot, "plugin-set.json");
  const pluginSet = JSON.parse(await readFile(pluginSetPath, "utf8"));
  const packs = [];
  for (const packReference of pluginSet.packs) {
    const packPath = resolve(dirname(pluginSetPath), packReference);
    const pack = JSON.parse(await readFile(packPath, "utf8"));
    const plugins = [];
    for (const pluginReference of pack.plugins) {
      const manifest = JSON.parse(
        await readFile(resolve(dirname(packPath), pluginReference), "utf8"),
      );
      plugins.push({
        apiVersion: manifest.apiVersion,
        id: manifest.id,
        schemaVersion: manifest.schemaVersion,
      });
    }
    packs.push({
      host: pack.host,
      id: pack.id,
      plugins,
      schemaVersion: pack.schemaVersion,
    });
  }
  return {
    artifactSha256: await hashDirectory(pluginRoot),
    packs,
    schemaVersion: pluginSet.schemaVersion,
  };
}

async function hashDirectory(directory) {
  const hash = createHash("sha256");
  const files = await listFiles(directory);
  for (const file of files) {
    hash.update(relative(directory, file));
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function hashFile(path) {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function assertProductionBuildExists(serverEntryPath) {
  try {
    await readFile(serverEntryPath);
  } catch {
    throw new Error(
      "Production server bundle is missing; run npm run build:server first",
    );
  }
}

async function readGitOutput(root, args) {
  const execution = await captureProcess("git", args, { cwd: root });
  return execution.code === 0 ? execution.stdout.trim() : "";
}

function captureProcess(command, args, options = {}) {
  return new Promise((resolveExecution, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let stdout = "";
    child.stderr.setEncoding("utf8");
    child.stdout.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolveExecution({ code: code ?? (signal ? 1 : 0), stderr, stdout });
    });
  });
}
