#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import {
  captureHostEnvironment,
  captureServerMetadata,
  resolveLoadGeneratorMachine,
  validateServerMetadata,
} from "./server-baseline-environment.mjs";
import {
  analysisPolicy,
  curateLoadRun,
  resolvePathAdjustedThresholds,
  summarizeBaselineRuns,
} from "./server-baseline-helpers.mjs";
import {
  parseNonNegativeInteger,
  parseNonNegativeNumber,
  parsePositiveInteger,
  parsePositiveNumber,
  summarizeNumbers,
} from "./server-load-helpers.mjs";

const root = process.cwd();
const scenariosPath = resolve(root, "benchmarks/server/scenarios.json");
const serverEntryPath = resolve(root, "dist/server/main.js");
const pathLatencySamples = 200;

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

async function main() {
  const options = parseOptions();
  const definitions = JSON.parse(await readFile(scenariosPath, "utf8"));
  const selectedScenarios = selectScenarios(definitions.scenarios, options);
  const [loadGeneratorEnvironment, serverMetadata] = await Promise.all([
    captureHostEnvironment(root),
    options.serverMetadataPath
      ? readServerMetadata(options.serverMetadataPath)
      : captureServerMetadata({ machine: options.machine, root }),
  ]);
  options.serverBuild = serverMetadata.serverBuild;
  const outputPath = options.output
    ? resolve(options.output)
    : options.profile === "reference"
      ? resolve(
          root,
          "benchmarks/server/baselines",
          serverMetadata.machine,
          `${serverMetadata.commit}.json`,
        )
      : undefined;
  const remote = Boolean(options.serverUrl);
  options.pathLatencyMillis = summarizeNumbers([]);
  options.thresholds = resolvePathAdjustedThresholds(options.pathLatencyMillis);
  const result = {
    schemaVersion: 4,
    analysisPolicy,
    commit: serverMetadata.commit,
    cpu: serverMetadata.cpu,
    dirty: serverMetadata.dirty,
    environment: {
      cpuAffinity: serverMetadata.cpuAffinity,
      loadGenerator: remote
        ? "separate-host-separate-process"
        : "same-host-separate-process",
      loadGeneratorEnvironment: {
        ...loadGeneratorEnvironment,
        machine: resolveLoadGeneratorMachine({
          configuredMachine: options.loadGeneratorMachine,
          observedMachine: loadGeneratorEnvironment.machine,
          remote,
          serverMachine: serverMetadata.machine,
        }),
      },
      machine: serverMetadata.machine,
      nodeOptions: serverMetadata.nodeOptions,
      pathLatencyMillis: options.pathLatencyMillis,
      serverEnvironment: {
        commit: serverMetadata.commit,
        container: serverMetadata.container,
        cpu: serverMetadata.cpu,
        cpuTopology: serverMetadata.cpuTopology,
        dirty: serverMetadata.dirty,
        machine: serverMetadata.machine,
        nodeOptions: serverMetadata.nodeOptions,
        nodeVersion: serverMetadata.nodeVersion,
        platform: serverMetadata.platform,
        virtualization: serverMetadata.virtualization,
      },
      topology: options.topology,
    },
    finishedAt: null,
    machine: serverMetadata.machine,
    measurementSeconds: options.durationSeconds,
    nodeVersion: serverMetadata.nodeVersion,
    platform: serverMetadata.platform,
    pluginIdentity: serverMetadata.pluginIdentity,
    profile: options.profile,
    protocol: {
      productionBuildCreatedOnce: true,
      repetitions: options.repetitions,
      restartStrategy: remote
        ? options.restartCommand
          ? "command"
          : "manual"
        : "local-process",
      serverArtifactSha256: serverMetadata.serverArtifactSha256,
      serverEntry: serverMetadata.serverEntry,
      serverMode: remote ? "remote" : "local",
      serverRestartedBetweenRepetitions: true,
      serverUrl: remote ? options.serverUrl : "dynamic-loopback",
    },
    provisionalThresholds: options.thresholds,
    capacitySweep: [],
    scenarios: [],
    startedAt: new Date().toISOString(),
    warmupSeconds: options.warmupSeconds,
  };

  for (const scenario of selectedScenarios) {
    result.scenarios.push(await runScenario(scenario, options));
    syncMeasuredThresholds(result, options);
    await persist(result, outputPath);
  }

  if (!options.skipCapacity) {
    const gameCounts = capacityGameCounts(
      definitions.capacitySweepGames,
      options.maxCapacityGames,
    );
    for (const games of gameCounts) {
      const scenario = {
        clientsPerGame: definitions.capacitySweepClientsPerGame,
        games,
        inputHzPerClient: 4,
        name: `capacity-${games}-games`,
        simulationMillisPerWallMillis: 1,
      };
      const captured = await runScenario(scenario, options);
      result.capacitySweep.push(captured);
      syncMeasuredThresholds(result, options);
      await persist(result, outputPath);
      if (captured.summary.confirmedSaturation) break;
    }
  }

  result.finishedAt = new Date().toISOString();
  result.firstCapacitySaturation =
    result.capacitySweep.find((scenario) =>
      Boolean(scenario.summary.confirmedSaturation),
    )?.scenario ?? null;
  await persist(result, outputPath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function parseOptions() {
  const { values } = parseArgs({
    options: {
      duration: { type: "string" },
      "load-generator-machine": { type: "string" },
      machine: { default: "wsl2-i7-7700hq", type: "string" },
      "max-capacity-games": { default: "128", type: "string" },
      output: { type: "string" },
      profile: { default: "reference", type: "string" },
      quiet: { default: false, type: "boolean" },
      repetitions: { type: "string" },
      "restart-command": { type: "string" },
      "restart-timeout": { default: "30", type: "string" },
      scenario: { multiple: true, type: "string" },
      seed: { default: "1", type: "string" },
      "server-metadata": { type: "string" },
      "server-url": { type: "string" },
      "skip-capacity": { default: false, type: "boolean" },
      "skip-matrix": { default: false, type: "boolean" },
      topology: { type: "string" },
      warmup: { type: "string" },
    },
  });
  if (values.profile !== "reference" && values.profile !== "smoke") {
    throw new Error("--profile must be reference or smoke");
  }
  const defaults =
    values.profile === "reference"
      ? { duration: 60, repetitions: 5, warmup: 15 }
      : { duration: 3, repetitions: 1, warmup: 1 };
  const machine = values.machine.trim();
  if (machine.length === 0) throw new Error("--machine must not be empty");
  const serverUrl = values["server-url"]
    ? normalizeServerUrl(values["server-url"])
    : undefined;
  const serverMetadataPath = values["server-metadata"]
    ? resolve(values["server-metadata"])
    : undefined;
  if (Boolean(serverUrl) !== Boolean(serverMetadataPath)) {
    throw new Error("--server-url and --server-metadata must be used together");
  }
  const restartCommand = values["restart-command"]?.trim();
  if (restartCommand && !serverUrl) {
    throw new Error("--restart-command requires --server-url");
  }
  const topology =
    values.topology?.trim() ??
    (serverUrl ? "separate-host-lan" : "same-host-loopback");
  if (!topology) throw new Error("--topology must not be empty");
  const loadGeneratorMachine = values["load-generator-machine"]?.trim();
  if (values["load-generator-machine"] && !loadGeneratorMachine) {
    throw new Error("--load-generator-machine must not be empty");
  }
  return {
    durationSeconds: values.duration
      ? parsePositiveNumber(values.duration, "duration")
      : defaults.duration,
    machine,
    loadGeneratorMachine,
    maxCapacityGames: parsePositiveInteger(
      values["max-capacity-games"],
      "max-capacity-games",
    ),
    output: values.output,
    profile: values.profile,
    quiet: values.quiet,
    repetitions: values.repetitions
      ? parsePositiveInteger(values.repetitions, "repetitions")
      : defaults.repetitions,
    restartCommand,
    restartTimeoutSeconds: parsePositiveNumber(
      values["restart-timeout"],
      "restart-timeout",
    ),
    scenarioNames: values.scenario ?? [],
    seed: parseNonNegativeInteger(values.seed, "seed"),
    serverMetadataPath,
    serverUrl,
    skipCapacity: values["skip-capacity"],
    skipMatrix: values["skip-matrix"],
    topology,
    warmupSeconds: values.warmup
      ? parseNonNegativeNumber(values.warmup, "warmup")
      : defaults.warmup,
  };
}

function selectScenarios(scenarios, options) {
  if (options.skipMatrix) return [];
  if (options.scenarioNames.length === 0) return scenarios;
  const selected = scenarios.filter((scenario) =>
    options.scenarioNames.includes(scenario.name),
  );
  const missing = options.scenarioNames.filter(
    (name) => !selected.some((scenario) => scenario.name === name),
  );
  if (missing.length > 0) {
    throw new Error(`Unknown scenarios: ${missing.join(", ")}`);
  }
  return selected;
}

function capacityGameCounts(initialCounts, maximumGames) {
  const counts = initialCounts.filter((count) => count <= maximumGames);
  let next = counts.at(-1) ?? 1;
  while (next < maximumGames) {
    next *= 2;
    if (next <= maximumGames && !counts.includes(next)) counts.push(next);
  }
  return counts;
}

function syncMeasuredThresholds(result, options) {
  result.environment.pathLatencyMillis = options.pathLatencyMillis;
  result.provisionalThresholds = options.thresholds;
}

async function ensurePathLatency(options, url) {
  if (options.pathLatencyMillis.count > 0) return;
  options.pathLatencyMillis = await measurePathLatency(url, options.quiet);
  options.thresholds = resolvePathAdjustedThresholds(options.pathLatencyMillis);
}

async function measurePathLatency(url, quiet) {
  const samples = [];
  const endpoint = new URL("/health", url);
  for (let attempt = 0; attempt < pathLatencySamples; attempt++) {
    const startedAt = performance.now();
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      await response.arrayBuffer();
      if (response.ok) samples.push(performance.now() - startedAt);
    } catch {
      break;
    }
  }
  const summary = summarizeNumbers(samples);
  if (!quiet) {
    process.stderr.write(
      `[baseline] path latency over ${summary.count} probes: ` +
        `p50 ${summary.p50.toFixed(3)}ms p99 ${summary.p99.toFixed(3)}ms\n`,
    );
  }
  return summary;
}

async function runScenario(scenario, options) {
  const runs = [];
  for (let repetition = 1; repetition <= options.repetitions; repetition++) {
    log(
      options,
      `[baseline] ${scenario.name} repetition ${repetition}/${options.repetitions}`,
    );
    const server = options.serverUrl
      ? await prepareRemoteServer({ options, repetition, scenario })
      : await startServer();
    try {
      await ensurePathLatency(options, server.url);
      const loadResult = await runLoadGenerator({
        options,
        repetition,
        scenario,
        serverUrl: server.url,
      });
      runs.push(
        curateLoadRun(loadResult.samples[0], repetition, options.thresholds),
      );
    } finally {
      await server.stop();
    }
  }
  return {
    runs,
    scenario: {
      clientsPerGame: scenario.clientsPerGame,
      games: scenario.games,
      inputHzPerClient: scenario.inputHzPerClient,
      name: scenario.name,
      simulationMillisPerWallMillis: scenario.simulationMillisPerWallMillis,
    },
    summary: summarizeBaselineRuns(runs),
  };
}

async function runLoadGenerator({ options, repetition, scenario, serverUrl }) {
  const args = [
    resolve(root, "scripts/run-server-load.mjs"),
    "--url",
    serverUrl,
    "--games",
    String(scenario.games),
    "--clients-per-game",
    String(scenario.clientsPerGame),
    "--input-hz",
    String(scenario.inputHzPerClient),
    "--sim-rate",
    String(scenario.simulationMillisPerWallMillis),
    "--warmup",
    String(options.warmupSeconds),
    "--duration",
    String(options.durationSeconds),
    "--repetitions",
    "1",
    "--seed",
    String(options.seed + repetition - 1),
    "--server-build",
    options.serverBuild,
    "--quiet",
  ];
  const execution = await captureProcess(process.execPath, args);
  let result;
  try {
    result = JSON.parse(execution.stdout);
  } catch (error) {
    throw new Error(
      `Load generator emitted invalid JSON (exit ${execution.code}): ${execution.stderr || execution.stdout}`,
      { cause: error },
    );
  }
  if (execution.code !== 0 && result.summary?.failedRuns === 0) {
    throw new Error(
      `Load generator exited ${execution.code}: ${execution.stderr || "no stderr"}`,
    );
  }
  return result;
}

async function prepareRemoteServer({ options, repetition, scenario }) {
  if (options.restartCommand) {
    await runRestartCommand(options, repetition, scenario);
  } else {
    await waitForManualRestart(options, repetition, scenario);
  }
  await waitForServerReady(options.serverUrl, options.restartTimeoutSeconds);
  return { stop: async () => undefined, url: options.serverUrl };
}

async function runRestartCommand(options, repetition, scenario) {
  log(options, `[baseline] running remote restart command`);
  const execution = await captureShellCommand(options.restartCommand, {
    SOLITUDE_BASELINE_REPETITION: String(repetition),
    SOLITUDE_BASELINE_SCENARIO: scenario.name,
    SOLITUDE_SERVER_URL: options.serverUrl,
  });
  if (execution.code !== 0) {
    throw new Error(
      `Remote restart command exited ${execution.code}: ${execution.stderr || execution.stdout || "no output"}`,
    );
  }
}

async function waitForManualRestart(options, repetition, scenario) {
  if (!process.stdin.isTTY) {
    throw new Error(
      "Remote manual restart requires an interactive terminal; use --restart-command for unattended runs",
    );
  }
  const readline = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  try {
    await readline.question(
      `[baseline] Restart ${options.serverUrl} for ${scenario.name} repetition ${repetition}, then press Enter to continue. `,
    );
  } finally {
    readline.close();
  }
}

async function waitForServerReady(serverUrl, timeoutSeconds) {
  const healthUrl = `${serverUrl}/health`;
  const deadline = Date.now() + timeoutSeconds * 1_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(
    `Remote server did not become healthy at ${healthUrl} within ${timeoutSeconds} seconds: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

function normalizeServerUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error(`--server-url must be an absolute HTTP(S) URL: ${value}`, {
      cause: error,
    });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("--server-url must use http or https");
  }
  return parsed.href.replace(/\/$/, "");
}

async function readServerMetadata(path) {
  let metadata;
  try {
    metadata = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read server metadata from ${path}`, {
      cause: error,
    });
  }
  return validateServerMetadata(metadata, path);
}

async function startServer() {
  const child = spawn(process.execPath, [serverEntryPath], {
    cwd: root,
    env: {
      ...process.env,
      DIST_DIR: resolve(root, "dist/server-baseline-no-client"),
      HOST: "127.0.0.1",
      PORT: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  let stdoutBuffer = "";
  child.stderr.setEncoding("utf8");
  child.stdout.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-16_384);
  });

  let url;
  try {
    url = await new Promise((resolveUrl, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(`Server startup timed out: ${stderr || stdoutBuffer}`),
        );
      }, 15_000);
      const fail = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
      child.once("error", fail);
      child.once("exit", (code) => {
        fail(
          new Error(
            `Server exited before listening (${code}): ${stderr || stdoutBuffer}`,
          ),
        );
      });
      child.stdout.on("data", (chunk) => {
        stdoutBuffer += chunk;
        const match = stdoutBuffer.match(
          /Solitude server listening at (http:\/\/[^\s]+)/,
        );
        if (match) {
          clearTimeout(timeout);
          resolveUrl(match[1]);
        }
      });
    });
  } catch (error) {
    await stopChild(child);
    throw error;
  }

  return { stop: () => stopChild(child), url };
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolveExit) => child.once("exit", () => resolveExit(true))),
    new Promise((resolveTimeout) =>
      setTimeout(() => resolveTimeout(false), 5_000),
    ),
  ]);
  if (!exited && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await new Promise((resolveExit) => child.once("exit", resolveExit));
  }
}

function captureProcess(command, args) {
  return new Promise((resolveExecution, reject) => {
    const child = spawn(command, args, {
      cwd: root,
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

function captureShellCommand(command, environment) {
  return new Promise((resolveExecution, reject) => {
    const child = spawn(command, {
      cwd: root,
      env: { ...process.env, ...environment },
      shell: true,
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

async function persist(result, outputPath) {
  if (!outputPath) return;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

function log(options, message) {
  if (!options.quiet) process.stderr.write(`${message}\n`);
}
