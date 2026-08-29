import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { arch, cpus, hostname, platform, release } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

const HVCI_SECURITY_SERVICE = 2;
const VBS_STATUS = ["off", "enabled", "running"];
const WINDOWS_PROBE_TIMEOUT_MILLIS = 5000;
const WINDOWS_HOST_FACTS_SCRIPT = [
  "$ErrorActionPreference='SilentlyContinue';",
  "$guard=Get-CimInstance -ClassName Win32_DeviceGuard",
  " -Namespace root\\Microsoft\\Windows\\DeviceGuard;",
  "$processors=Get-CimInstance Win32_Processor;",
  "[pscustomobject]@{",
  "hypervisorPresent=[bool](Get-CimInstance Win32_ComputerSystem)",
  ".HypervisorPresent;",
  "logicalCores=($processors|Measure-Object NumberOfLogicalProcessors -Sum)",
  ".Sum;",
  "physicalCores=($processors|Measure-Object NumberOfCores -Sum).Sum;",
  "securityServicesRunning=@($guard.SecurityServicesRunning);",
  "vbsStatus=$guard.VirtualizationBasedSecurityStatus",
  "}|ConvertTo-Json -Compress",
].join("");

export async function captureHostEnvironment(root = process.cwd()) {
  const [commit, status, runtime, windowsHost] = await Promise.all([
    readGitOutput(root, ["rev-parse", "HEAD"]),
    readGitOutput(root, ["status", "--porcelain"]),
    detectRuntime(),
    readWindowsHostFacts(),
  ]);
  const processors = cpus();
  return {
    commit: commit || "unknown",
    cpu: processors[0]?.model ?? "unknown",
    cpuTopology: summarizeCpuTopology(processors, windowsHost),
    dirty: status.length > 0,
    machine: hostname(),
    nodeOptions: process.env.NODE_OPTIONS ?? "",
    nodeVersion: process.version,
    platform: `${platform()} ${release()} ${arch()}`,
    virtualization: summarizeVirtualization(runtime, windowsHost),
  };
}

export function summarizeCpuTopology(processors, windowsHost) {
  const logicalCores = windowsHost?.logicalCores ?? processors.length;
  const physicalCores = windowsHost?.physicalCores ?? 0;
  return {
    hybrid:
      physicalCores > 0
        ? logicalCores > physicalCores && logicalCores < physicalCores * 2
        : null,
    logicalCores,
    models: [...new Set(processors.map((processor) => processor.model))].sort(),
    physicalCores: physicalCores || null,
    visibleLogicalCores: processors.length,
  };
}

export function summarizeVirtualization(runtime, windowsHost) {
  return {
    hypervisorPresent: windowsHost
      ? Boolean(windowsHost.hypervisorPresent)
      : runtime.hypervisorFlag,
    runtime:
      runtime.name === "unknown" && windowsHost ? "windows-host" : runtime.name,
    vbs: summarizeDeviceGuard(windowsHost),
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
    cpuTopology: host.cpuTopology,
    dirty: host.dirty,
    machine,
    nodeOptions: host.nodeOptions,
    nodeVersion: host.nodeVersion,
    platform: host.platform,
    pluginIdentity,
    serverArtifactSha256,
    serverBuild: "production",
    serverEntry: relative(root, serverEntryPath),
    virtualization: host.virtualization,
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
  for (const field of ["cpuTopology", "virtualization"]) {
    if (
      value[field] !== undefined &&
      (!value[field] || typeof value[field] !== "object")
    ) {
      throw new Error(`${source}.${field} must be an object when present`);
    }
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

function summarizeDeviceGuard(windowsHost) {
  if (!windowsHost || typeof windowsHost.vbsStatus !== "number") return null;
  return {
    hvci: windowsHost.securityServicesRunning.includes(HVCI_SECURITY_SERVICE),
    status: VBS_STATUS[windowsHost.vbsStatus] ?? "unknown",
  };
}

async function detectRuntime() {
  if (platform() !== "linux") {
    return { hypervisorFlag: false, name: "unknown" };
  }
  const [version, cpuinfo] = await Promise.all([
    readOptionalFile("/proc/version"),
    readOptionalFile("/proc/cpuinfo"),
  ]);
  const hypervisorFlag = /^flags\s*:.*\bhypervisor\b/m.test(cpuinfo);
  if (process.env.WSL_DISTRO_NAME || /microsoft/i.test(version)) {
    return { hypervisorFlag: true, name: "wsl2" };
  }
  return {
    hypervisorFlag,
    name: hypervisorFlag ? "virtual-machine" : "bare-metal",
  };
}

async function readWindowsHostFacts() {
  if (platform() !== "win32" && !process.env.WSL_INTEROP) return null;
  try {
    const execution = await captureProcess(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_HOST_FACTS_SCRIPT],
      { timeoutMillis: WINDOWS_PROBE_TIMEOUT_MILLIS },
    );
    if (execution.code !== 0) return null;
    const facts = JSON.parse(execution.stdout);
    return {
      hypervisorPresent: facts.hypervisorPresent,
      logicalCores: facts.logicalCores,
      physicalCores: facts.physicalCores,
      securityServicesRunning: Array.isArray(facts.securityServicesRunning)
        ? facts.securityServicesRunning
        : [],
      vbsStatus: facts.vbsStatus,
    };
  } catch {
    return null;
  }
}

async function readOptionalFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
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
    const timeout = options.timeoutMillis
      ? setTimeout(() => child.kill("SIGKILL"), options.timeoutMillis)
      : undefined;
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolveExecution({ code: code ?? (signal ? 1 : 0), stderr, stdout });
    });
  });
}
