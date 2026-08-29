import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { arch, cpus, hostname, platform, release } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

const HVCI_SECURITY_SERVICE = 2;
const CONTAINER_ENGINES = new Set([
  "containerd",
  "docker",
  "lxc",
  "none",
  "podman",
  "unknown",
]);
const CONTAINER_CGROUP_ENGINES = [
  ["docker", /\bdocker\b/],
  ["podman", /\b(?:podman|libpod)\b/],
  ["containerd", /\b(?:containerd|kubepods)\b/],
  ["lxc", /\blxc\b/],
];
const DEVCONTAINER_VARIABLES = [
  "CODESPACES",
  "DEVCONTAINER",
  "REMOTE_CONTAINERS",
  "REMOTE_CONTAINERS_IPC",
];
const VBS_STATUS = ["off", "enabled", "running"];
const VBS_STATUSES = new Set([...VBS_STATUS, "unknown"]);
const VIRTUALIZATION_RUNTIMES = new Set([
  "bare-metal",
  "virtual-machine",
  "wsl2",
  "windows-host",
  "unknown",
]);
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
  const [commit, status, container, runtime, windowsHost] = await Promise.all([
    readGitOutput(root, ["rev-parse", "HEAD"]),
    readGitOutput(root, ["status", "--porcelain"]),
    detectContainer(),
    detectRuntime(),
    readWindowsHostFacts(),
  ]);
  const processors = cpus();
  return {
    commit: commit || "unknown",
    container,
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

export function summarizeContainer({
  cgroup,
  containerEnvFile,
  dockerEnvFile,
  environment,
}) {
  const devcontainer = DEVCONTAINER_VARIABLES.some((name) =>
    Boolean(environment[name]),
  );
  const cgroupEngine = CONTAINER_CGROUP_ENGINES.find(([, pattern]) =>
    pattern.test(cgroup),
  )?.[0];
  const engine = dockerEnvFile
    ? (cgroupEngine ?? "docker")
    : containerEnvFile
      ? (cgroupEngine ?? "podman")
      : (cgroupEngine ??
        (environment.container || devcontainer ? "unknown" : "none"));
  return {
    devcontainer,
    engine,
    present: engine !== "none",
  };
}

export function resolveLoadGeneratorMachine({
  configuredMachine,
  remote,
  observedMachine,
  serverMachine,
}) {
  return configuredMachine ?? (remote ? observedMachine : serverMachine);
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
    schemaVersion: 3,
    capturedAt: new Date().toISOString(),
    commit: host.commit,
    container: host.container,
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
  if (!isRecord(value) || value.schemaVersion !== 3) {
    throw new Error(`${source} must be a version-3 server metadata document`);
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
  if (!isRecord(value.pluginIdentity)) {
    throw new Error(`${source}.pluginIdentity must be an object`);
  }
  validateContainer(value.container, `${source}.container`);
  validateCpuTopology(value.cpuTopology, `${source}.cpuTopology`);
  validateVirtualization(value.virtualization, `${source}.virtualization`);
  return value;
}

function validateContainer(value, source) {
  if (!isRecord(value)) throw new Error(`${source} must be an object`);
  if (typeof value.devcontainer !== "boolean") {
    throw new Error(`${source}.devcontainer must be a boolean`);
  }
  if (!CONTAINER_ENGINES.has(value.engine)) {
    throw new Error(`${source}.engine is not recognized`);
  }
  if (typeof value.present !== "boolean") {
    throw new Error(`${source}.present must be a boolean`);
  }
}

function validateCpuTopology(value, source) {
  if (!isRecord(value)) throw new Error(`${source} must be an object`);
  if (typeof value.hybrid !== "boolean" && value.hybrid !== null) {
    throw new Error(`${source}.hybrid must be a boolean or null`);
  }
  for (const field of ["logicalCores", "visibleLogicalCores"]) {
    if (!Number.isInteger(value[field]) || value[field] < 1) {
      throw new Error(`${source}.${field} must be a positive integer`);
    }
  }
  if (
    value.physicalCores !== null &&
    (!Number.isInteger(value.physicalCores) || value.physicalCores < 1)
  ) {
    throw new Error(
      `${source}.physicalCores must be a positive integer or null`,
    );
  }
  if (
    !Array.isArray(value.models) ||
    value.models.some((model) => typeof model !== "string")
  ) {
    throw new Error(`${source}.models must be an array of strings`);
  }
}

function validateVirtualization(value, source) {
  if (!isRecord(value)) throw new Error(`${source} must be an object`);
  if (typeof value.hypervisorPresent !== "boolean") {
    throw new Error(`${source}.hypervisorPresent must be a boolean`);
  }
  if (!VIRTUALIZATION_RUNTIMES.has(value.runtime)) {
    throw new Error(`${source}.runtime is not recognized`);
  }
  if (value.vbs === null) return;
  if (!isRecord(value.vbs)) {
    throw new Error(`${source}.vbs must be an object or null`);
  }
  if (typeof value.vbs.hvci !== "boolean") {
    throw new Error(`${source}.vbs.hvci must be a boolean`);
  }
  if (!VBS_STATUSES.has(value.vbs.status)) {
    throw new Error(`${source}.vbs.status is not recognized`);
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

async function detectContainer() {
  if (platform() !== "linux") {
    return { devcontainer: false, engine: "none", present: false };
  }
  const [cgroup, containerEnvFile, dockerEnvFile] = await Promise.all([
    readOptionalFile("/proc/1/cgroup"),
    fileExists("/run/.containerenv"),
    fileExists("/.dockerenv"),
  ]);
  return summarizeContainer({
    cgroup,
    containerEnvFile,
    dockerEnvFile,
    environment: process.env,
  });
}

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
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
