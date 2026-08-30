#!/usr/bin/env node

import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { arch, cpus, platform, release } from "node:os";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { parseArgs, promisify } from "node:util";
import { WebSocket } from "ws";
import {
  createSeededRandom,
  decodeSocketMessage,
  deriveGeneratorSaturation,
  parseNonNegativeInteger,
  parseNonNegativeNumber,
  parsePositiveInteger,
  parsePositiveNumber,
  summarizeGeneratorSamples,
  summarizeNumbers,
  summarizeRuns,
  summarizeServerReports,
} from "./server-load-helpers.mjs";

const execFileAsync = promisify(execFile);
const socketResponseTimeoutMillis = 10_000;
const inputDrainMillis = 250;
const metricsFetchAttempts = 3;
const metricsRetryDelayMillis = 100;
const maximumDroppedMetricsSampleRatio = 0.1;
const generatorSaturationThresholds = Object.freeze({
  cpuRatio: 0.85,
  eventLoopMillis: 16.67,
});

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

async function main() {
  const options = parseOptions();
  const environment = await readEnvironmentMetadata();
  const startedAt = new Date().toISOString();
  const latencyTracker = createInputLatencyTracker();
  const runs = [];
  let workload;

  try {
    workload = await createWorkload(options, latencyTracker);
    log(options, {
      event: "workloadReady",
      games: workload.gameIds,
      participants: workload.assignments.length,
    });

    for (let repetition = 0; repetition < options.repetitions; repetition++) {
      log(options, { event: "repetitionStarted", repetition: repetition + 1 });
      let run;
      try {
        run = await runRepetition({
          latencyTracker,
          options,
          repetition,
          workload,
        });
      } catch (error) {
        run = createFailedRun(repetition + 1, error);
      }
      runs.push(run);
      log(options, {
        errors: run.errors,
        event: "repetitionCompleted",
        repetition: repetition + 1,
      });
      if (run.errors.length > 0) break;
    }
  } catch (error) {
    runs.push(createFailedRun(1, error));
  } finally {
    await workload?.close();
  }

  const result = {
    schemaVersion: 1,
    commit: environment.commit,
    cpu: environment.cpu,
    dirty: environment.dirty,
    finishedAt: new Date().toISOString(),
    measurementSeconds: options.durationSeconds,
    nodeVersion: process.version,
    platform: environment.platform,
    repetitions: options.repetitions,
    samples: runs,
    scenario: {
      clientsPerGame: options.clientsPerGame,
      games: options.games,
      inputHzPerClient: options.inputHz,
      seed: options.seed,
      simulationMillisPerWallMillis: options.simulationRate,
    },
    serverBuild: options.serverBuild,
    serverRestartedBetweenRepetitions: false,
    serverUrl: options.url,
    startedAt,
    summary: summarizeRuns(runs),
    warmupSeconds: options.warmupSeconds,
  };
  const serialized = options.quiet
    ? JSON.stringify(result)
    : JSON.stringify(result, null, 2);
  if (options.output)
    await writeFile(options.output, `${serialized}\n`, "utf8");
  process.stdout.write(`${serialized}\n`);
  if (result.summary.failedRuns > 0) process.exitCode = 1;
}

function createFailedRun(repetition, error) {
  const emptyLatencySummary = summarizeNumbers([]);
  return {
    client: {
      inputAckLatencyMillis: emptyLatencySummary,
      pendingInputAcks: 0,
      snapshotInterArrivalMillis: emptyLatencySummary,
    },
    droppedMetricsSamples: 0,
    durationMillis: 0,
    errors: [error instanceof Error ? error.message : String(error)],
    finishedAt: new Date().toISOString(),
    generator: summarizeGeneratorSamples([], cpus().length),
    generatorSaturation: { reasons: [], saturated: false },
    inputEventsSent: 0,
    repetition,
    server: summarizeServerReports([], []),
    serverReports: [],
    startedAt: new Date().toISOString(),
  };
}

function parseOptions() {
  const { values } = parseArgs({
    options: {
      clients: { type: "string" },
      "clients-per-game": { default: "8", type: "string" },
      duration: { default: "15", type: "string" },
      games: { default: "1", type: "string" },
      "input-hz": { default: "4", type: "string" },
      latency: { default: false, type: "boolean" },
      "metrics-hz": { default: "1", type: "string" },
      output: { type: "string" },
      quiet: { default: false, type: "boolean" },
      repetitions: { default: "1", type: "string" },
      seed: { default: "1", type: "string" },
      "server-build": { default: "production", type: "string" },
      "sim-rate": { default: "1", type: "string" },
      url: { default: "http://127.0.0.1:8787", type: "string" },
      warmup: { default: "5", type: "string" },
    },
  });
  if (values.clients && values["clients-per-game"] !== "8") {
    throw new Error("Use either --clients or --clients-per-game, not both");
  }
  const serverBuild = values["server-build"].trim();
  if (serverBuild.length === 0) {
    throw new Error("--server-build must not be empty");
  }
  return {
    clientsPerGame: parsePositiveInteger(
      values.clients ?? values["clients-per-game"],
      values.clients ? "clients" : "clients-per-game",
    ),
    durationSeconds: parsePositiveNumber(values.duration, "duration"),
    games: parsePositiveInteger(values.games, "games"),
    inputHz: parseNonNegativeNumber(values["input-hz"], "input-hz"),
    metricsHz: parsePositiveNumber(values["metrics-hz"], "metrics-hz"),
    output: values.output,
    quiet: values.quiet,
    repetitions: parsePositiveInteger(values.repetitions, "repetitions"),
    seed: parseNonNegativeInteger(values.seed, "seed"),
    serverBuild,
    simulationRate: parsePositiveNumber(values["sim-rate"], "sim-rate"),
    url: values.url.replace(/\/$/, ""),
    warmupSeconds: parseNonNegativeNumber(values.warmup, "warmup"),
  };
}

async function createWorkload(options, latencyTracker) {
  const assignments = [];
  const gameIds = [];
  const sockets = [];
  let requestSequence = 1;

  try {
    for (let gameIndex = 0; gameIndex < options.games; gameIndex++) {
      const gameSockets = [];
      for (
        let clientIndex = 0;
        clientIndex < options.clientsPerGame;
        clientIndex++
      ) {
        const socket = await openSocket(
          `${options.url.replace(/^http/, "ws")}/socket`,
        );
        sockets.push(socket);
        gameSockets.push(socket);
      }

      const creatorClientId = createClientId(gameIndex, 0);
      const createResponse = await sendClientMessage(gameSockets[0], {
        clientId: creatorClientId,
        sequence: requestSequence++,
        type: "createGame",
      });
      const created = createResponse.messages.find(
        (message) => message.type === "gameCreated",
      );
      if (!created) {
        throw new Error(
          `Game ${gameIndex + 1} creation failed: ${JSON.stringify(createResponse)}`,
        );
      }
      gameIds.push(created.gameId);

      for (
        let clientIndex = 0;
        clientIndex < gameSockets.length;
        clientIndex++
      ) {
        const clientId = createClientId(gameIndex, clientIndex);
        const response = await sendClientMessage(gameSockets[clientIndex], {
          clientId,
          gameId: created.gameId,
          sequence: requestSequence++,
          type: "joinGame",
        });
        const joined = response.messages.find(
          (message) => message.type === "joined",
        );
        if (!joined) {
          throw new Error(
            `${clientId} failed to join ${created.gameId}: ${JSON.stringify(response)}`,
          );
        }
        const assignment = {
          clientId,
          entityId: joined.entityId,
          gameId: created.gameId,
          lastSnapshotReceivedAtMillis: undefined,
          nextInputSequence: 1,
          pendingInputs: [],
          snapshotCount: 0,
          socket: gameSockets[clientIndex],
        };
        assignment.socket.observe((message) => {
          latencyTracker.recordSocketMessage(
            assignment,
            message,
            performance.now(),
          );
        });
        assignments.push(assignment);
      }

      await sendClientMessage(gameSockets[0], {
        clientId: creatorClientId,
        gameId: created.gameId,
        sequence: requestSequence++,
        simulationMillisPerWallMillis: options.simulationRate,
        type: "setSimulationRate",
      });
    }

    return {
      assignments,
      close: () =>
        Promise.allSettled(sockets.map((socket) => socket.close())).then(
          () => undefined,
        ),
      gameIds,
      nextRequestSequence: () => requestSequence++,
      sockets,
    };
  } catch (error) {
    await Promise.allSettled(sockets.map((socket) => socket.close()));
    throw error;
  }
}

async function runRepetition({
  latencyTracker,
  options,
  repetition,
  workload,
}) {
  const random = createSeededRandom(options.seed + repetition);
  await fetchMetrics(options.url);
  if (options.warmupSeconds > 0) {
    await runPhase({
      collectMetrics: false,
      durationMillis: options.warmupSeconds * 1000,
      latencyTracker,
      options,
      random,
      workload,
    });
  }
  await fetchMetrics(options.url);
  latencyTracker.beginMeasurement(workload.assignments);
  const generatorMonitor = createGeneratorMonitor();
  const phase = await runPhase({
    collectMetrics: true,
    durationMillis: options.durationSeconds * 1000,
    generatorMonitor,
    latencyTracker,
    options,
    random,
    workload,
  });
  const generator = generatorMonitor.stop();
  await sleep(inputDrainMillis);
  phase.serverReports.push(await fetchMetrics(options.url));
  const client = latencyTracker.finishMeasurement(workload.assignments);
  const errors = validateRun({ client, phase, workload });

  return {
    client,
    droppedMetricsSamples: phase.droppedMetricsSamples,
    durationMillis: phase.durationMillis,
    errors,
    finishedAt: new Date().toISOString(),
    generator,
    generatorSaturation: deriveGeneratorSaturation(
      generator,
      generatorSaturationThresholds,
    ),
    inputEventsSent: phase.inputEventsSent,
    repetition: repetition + 1,
    server: summarizeServerReports(phase.serverReports, workload.gameIds),
    serverReports: phase.serverReports,
    startedAt: phase.startedAt,
  };
}

function createGeneratorMonitor() {
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  const samples = [];
  let cpuMarker = process.cpuUsage();
  let windowMarker = performance.now();
  histogram.enable();
  return {
    sample() {
      const cpu = process.cpuUsage(cpuMarker);
      const now = performance.now();
      const windowMillis = now - windowMarker;
      cpuMarker = process.cpuUsage();
      windowMarker = now;
      samples.push({
        cpuUtilizationPercent:
          windowMillis > 0
            ? ((cpu.user + cpu.system) / 1000) * (100 / windowMillis)
            : 0,
        eventLoopDelayMax: histogram.max / 1e6,
        eventLoopDelayP99: histogram.percentile(99) / 1e6,
        rssBytes: process.memoryUsage.rss(),
      });
      histogram.reset();
    },
    stop() {
      histogram.disable();
      return summarizeGeneratorSamples(samples, cpus().length);
    },
  };
}

async function runPhase({
  collectMetrics,
  durationMillis,
  generatorMonitor,
  latencyTracker,
  options,
  random,
  workload,
}) {
  const startedAt = new Date().toISOString();
  const startMillis = performance.now();
  const endMillis = startMillis + durationMillis;
  const inputIntervalMillis = options.inputHz > 0 ? 1000 / options.inputHz : 0;
  const metricsIntervalMillis = 1000 / options.metricsHz;
  let droppedMetricsSamples = 0;
  let inputEventsSent = 0;
  let nextInputMillis = startMillis;
  let nextMetricsMillis = startMillis + metricsIntervalMillis;
  const serverReports = [];

  while (performance.now() < endMillis) {
    const now = performance.now();
    while (inputIntervalMillis > 0 && now >= nextInputMillis) {
      for (const assignment of workload.assignments) {
        const inputSequence = assignment.nextInputSequence++;
        latencyTracker.recordInputSent(
          assignment,
          inputSequence,
          performance.now(),
        );
        sendClientMessageEvent(assignment.socket, {
          clientId: assignment.clientId,
          controls: {
            burnForward: true,
            thrust5: true,
            yawLeft: random() < 0.5,
          },
          entityId: assignment.entityId,
          gameId: assignment.gameId,
          inputSequence,
          sequence: workload.nextRequestSequence(),
          type: "input",
        });
        inputEventsSent++;
      }
      nextInputMillis += inputIntervalMillis;
    }

    if (collectMetrics && now >= nextMetricsMillis) {
      try {
        serverReports.push(await fetchMetricsOnce(options.url));
      } catch {
        droppedMetricsSamples++;
      }
      generatorMonitor?.sample();
      nextMetricsMillis += metricsIntervalMillis;
    }
    await sleep(2);
  }

  return {
    droppedMetricsSamples,
    durationMillis: performance.now() - startMillis,
    inputEventsSent,
    serverReports,
    startedAt,
  };
}

function validateRun({ client, phase, workload }) {
  const errors = [];
  const expectedSamples =
    phase.serverReports.length + phase.droppedMetricsSamples;
  if (
    phase.droppedMetricsSamples >
    expectedSamples * maximumDroppedMetricsSampleRatio
  ) {
    errors.push(
      `${phase.droppedMetricsSamples} of ${expectedSamples} metrics samples were lost`,
    );
  }
  for (const socket of workload.sockets) {
    if (socket.closedUnexpectedly()) errors.push("A load socket closed early");
  }
  const finalReport = phase.serverReports.at(-1);
  for (const gameId of workload.gameIds) {
    const game = finalReport?.games.find(
      (candidate) => candidate.gameId === gameId,
    );
    if (!game) errors.push(`Metrics omitted ${gameId}`);
    else if (!game.running) errors.push(`${gameId} stopped during measurement`);
  }
  for (const assignment of workload.assignments) {
    if (assignment.snapshotCount === 0) {
      errors.push(`${assignment.clientId} received no measured snapshots`);
    }
  }
  if (client.pendingInputAcks > 0) {
    errors.push(
      `${client.pendingInputAcks} input acknowledgements remained pending`,
    );
  }
  return [...new Set(errors)];
}

async function openSocket(socketUrl) {
  const socket = new WebSocket(socketUrl);
  const observers = [];
  const waiters = [];
  let intentionalClose = false;
  let unexpectedClose = false;

  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  socket.on("message", (data) => {
    const { message, snapshot } = decodeSocketMessage(data);
    for (const observer of observers) observer(message);
    if (snapshot) return;
    for (let index = waiters.length - 1; index >= 0; index--) {
      const waiter = waiters[index];
      if (waiter.predicate(message)) {
        waiters.splice(index, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(message);
      }
    }
  });
  socket.on("close", () => {
    if (!intentionalClose) unexpectedClose = true;
    for (const waiter of waiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("Socket closed while awaiting a response"));
    }
  });

  return {
    close: () =>
      new Promise((resolve) => {
        intentionalClose = true;
        if (
          socket.readyState === WebSocket.CLOSED ||
          socket.readyState === WebSocket.CLOSING
        ) {
          resolve();
          return;
        }
        socket.once("close", resolve);
        socket.close();
      }),
    closedUnexpectedly: () => unexpectedClose,
    observe: (observer) => observers.push(observer),
    readUntil: (predicate) =>
      new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          reject,
          resolve,
          timeout: setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index >= 0) waiters.splice(index, 1);
            reject(new Error("Timed out awaiting a socket response"));
          }, socketResponseTimeoutMillis),
        };
        waiters.push(waiter);
      }),
    send: (payload) => {
      if (socket.readyState !== WebSocket.OPEN) {
        throw new Error("Cannot send through a closed load socket");
      }
      socket.send(JSON.stringify(payload));
    },
  };
}

async function sendClientMessage(socket, message) {
  const response = socket.readUntil(
    (item) => item.type === "messages" && item.requestId === message.sequence,
  );
  socket.send({
    message,
    requestId: message.sequence,
    type: "clientMessage",
  });
  return response;
}

function sendClientMessageEvent(socket, message) {
  socket.send({ message, type: "clientMessageEvent" });
}

function createInputLatencyTracker() {
  const ackLatencies = [];
  const snapshotInterArrivalMillis = [];
  let measuring = false;

  return {
    beginMeasurement: (assignments) => {
      ackLatencies.length = 0;
      snapshotInterArrivalMillis.length = 0;
      for (const assignment of assignments) {
        assignment.lastSnapshotReceivedAtMillis = undefined;
        assignment.pendingInputs.length = 0;
        assignment.snapshotCount = 0;
      }
      measuring = true;
    },
    finishMeasurement: (assignments) => {
      measuring = false;
      return {
        inputAckLatencyMillis: summarizeNumbers(ackLatencies),
        pendingInputAcks: assignments.reduce(
          (total, assignment) => total + assignment.pendingInputs.length,
          0,
        ),
        snapshotInterArrivalMillis: summarizeNumbers(
          snapshotInterArrivalMillis,
        ),
      };
    },
    recordInputSent: (assignment, inputSequence, sentAtMillis) => {
      if (!measuring) return;
      assignment.pendingInputs.push({ inputSequence, sentAtMillis });
    },
    recordSocketMessage: (assignment, message, receivedAtMillis) => {
      if (
        !measuring ||
        message.type !== "serverMessage" ||
        message.message?.type !== "snapshot"
      ) {
        return;
      }
      assignment.snapshotCount++;
      if (assignment.lastSnapshotReceivedAtMillis !== undefined) {
        snapshotInterArrivalMillis.push(
          receivedAtMillis - assignment.lastSnapshotReceivedAtMillis,
        );
      }
      assignment.lastSnapshotReceivedAtMillis = receivedAtMillis;

      const lastProcessedInputSequence =
        message.message.lastProcessedInputSequences[assignment.entityId] ?? 0;
      let writeIndex = 0;
      for (
        let readIndex = 0;
        readIndex < assignment.pendingInputs.length;
        readIndex++
      ) {
        const input = assignment.pendingInputs[readIndex];
        if (input.inputSequence <= lastProcessedInputSequence) {
          ackLatencies.push(receivedAtMillis - input.sentAtMillis);
        } else {
          assignment.pendingInputs[writeIndex++] = input;
        }
      }
      assignment.pendingInputs.length = writeIndex;
    },
  };
}

async function fetchMetrics(url, attempts = metricsFetchAttempts) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetchMetricsOnce(url);
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await sleep(metricsRetryDelayMillis);
    }
  }
  throw lastError;
}

async function fetchMetricsOnce(url) {
  const response = await fetch(`${url}/metrics`);
  if (!response.ok) {
    throw new Error(`Metrics request failed with HTTP ${response.status}`);
  }
  const report = await response.json();
  if (!Array.isArray(report.games) || typeof report.process !== "object") {
    throw new Error("Metrics response has an unexpected shape");
  }
  return report;
}

async function readEnvironmentMetadata() {
  const [commit, status] = await Promise.all([
    readGitOutput(["rev-parse", "HEAD"]),
    readGitOutput(["status", "--porcelain"]),
  ]);
  return {
    commit: commit || "unknown",
    cpu: cpus()[0]?.model ?? "unknown",
    dirty: status.length > 0,
    platform: `${platform()} ${release()} ${arch()}`,
  };
}

async function readGitOutput(args) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

function createClientId(gameIndex, clientIndex) {
  return `load-client:g${gameIndex + 1}:c${clientIndex + 1}`;
}

function log(options, value) {
  if (!options.quiet) process.stderr.write(`${JSON.stringify(value)}\n`);
}

function sleep(durationMillis) {
  return new Promise((resolve) => setTimeout(resolve, durationMillis));
}
