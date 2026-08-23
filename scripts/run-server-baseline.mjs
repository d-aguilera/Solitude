#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { arch, cpus, platform, release } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  curateLoadRun,
  provisionalThresholds,
  summarizeBaselineRuns,
} from "./server-baseline-helpers.mjs";
import {
  parseNonNegativeInteger,
  parseNonNegativeNumber,
  parsePositiveInteger,
  parsePositiveNumber,
} from "./server-load-helpers.mjs";

const root = process.cwd();
const scenariosPath = resolve(root, "benchmarks/server/scenarios.json");
const serverEntryPath = resolve(root, "dist/server/main.js");
const pluginRoot = resolve(root, "dist/server/plugins");

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

async function main() {
  const options = parseOptions();
  const definitions = JSON.parse(await readFile(scenariosPath, "utf8"));
  const selectedScenarios = selectScenarios(definitions.scenarios, options);
  await assertProductionBuildExists();

  const [commit, status, pluginIdentity] = await Promise.all([
    readGitOutput(["rev-parse", "HEAD"]),
    readGitOutput(["status", "--porcelain"]),
    readPluginIdentity(),
  ]);
  const outputPath = options.output
    ? resolve(options.output)
    : options.profile === "reference"
      ? resolve(
          root,
          "benchmarks/server/baselines",
          options.machine,
          `${commit || "unknown"}.json`,
        )
      : undefined;
  const result = {
    schemaVersion: 1,
    commit: commit || "unknown",
    cpu: cpus()[0]?.model ?? "unknown",
    dirty: status.length > 0,
    environment: {
      cpuAffinity: "not-pinned",
      loadGenerator: "same-host-separate-process",
      machine: options.machine,
      nodeOptions: process.env.NODE_OPTIONS ?? "",
    },
    finishedAt: null,
    machine: options.machine,
    measurementSeconds: options.durationSeconds,
    nodeVersion: process.version,
    platform: `${platform()} ${release()} ${arch()}`,
    pluginIdentity,
    profile: options.profile,
    protocol: {
      productionBuildCreatedOnce: true,
      repetitions: options.repetitions,
      serverEntry: relative(root, serverEntryPath),
      serverRestartedBetweenRepetitions: true,
    },
    provisionalThresholds,
    capacitySweep: [],
    scenarios: [],
    startedAt: new Date().toISOString(),
    warmupSeconds: options.warmupSeconds,
  };

  for (const scenario of selectedScenarios) {
    result.scenarios.push(await runScenario(scenario, options));
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
      machine: { default: "wsl2-i7-7700hq", type: "string" },
      "max-capacity-games": { default: "128", type: "string" },
      output: { type: "string" },
      profile: { default: "reference", type: "string" },
      quiet: { default: false, type: "boolean" },
      repetitions: { type: "string" },
      scenario: { multiple: true, type: "string" },
      seed: { default: "1", type: "string" },
      "skip-capacity": { default: false, type: "boolean" },
      "skip-matrix": { default: false, type: "boolean" },
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
  return {
    durationSeconds: values.duration
      ? parsePositiveNumber(values.duration, "duration")
      : defaults.duration,
    machine,
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
    scenarioNames: values.scenario ?? [],
    seed: parseNonNegativeInteger(values.seed, "seed"),
    skipCapacity: values["skip-capacity"],
    skipMatrix: values["skip-matrix"],
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

async function runScenario(scenario, options) {
  const runs = [];
  for (let repetition = 1; repetition <= options.repetitions; repetition++) {
    log(
      options,
      `[baseline] ${scenario.name} repetition ${repetition}/${options.repetitions}`,
    );
    const server = await startServer();
    try {
      const loadResult = await runLoadGenerator({
        options,
        repetition,
        scenario,
        serverUrl: server.url,
      });
      runs.push(curateLoadRun(loadResult.samples[0], repetition));
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
    "production",
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

async function readPluginIdentity() {
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

async function assertProductionBuildExists() {
  try {
    await readFile(serverEntryPath);
  } catch {
    throw new Error(
      "Production server bundle is missing; run npm run build:server first",
    );
  }
}

async function persist(result, outputPath) {
  if (!outputPath) return;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function readGitOutput(args) {
  const execution = await captureProcess("git", args);
  return execution.code === 0 ? execution.stdout.trim() : "";
}

function log(options, message) {
  if (!options.quiet) process.stderr.write(`${message}\n`);
}
