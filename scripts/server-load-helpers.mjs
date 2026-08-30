export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function summarizeNumbers(values) {
  if (values.length === 0) {
    return { avg: 0, count: 0, max: 0, min: 0, p50: 0, p95: 0, p99: 0 };
  }
  const sorted = [...values].sort((left, right) => left - right);
  let total = 0;
  for (const value of sorted) total += value;
  return {
    avg: total / sorted.length,
    count: sorted.length,
    max: sorted[sorted.length - 1],
    min: sorted[0],
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

const SNAPSHOT_ENVELOPE_PREFIX = Buffer.from('{"message":{"type":"snapshot"');
const ACKNOWLEDGEMENTS_KEY = Buffer.from('"lastProcessedInputSequences":');
const BACKSLASH = 0x5c;
const QUOTE = 0x22;
const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

export function extractSnapshotAcknowledgements(data) {
  if (
    data.length < SNAPSHOT_ENVELOPE_PREFIX.length ||
    !data
      .subarray(0, SNAPSHOT_ENVELOPE_PREFIX.length)
      .equals(SNAPSHOT_ENVELOPE_PREFIX)
  ) {
    return null;
  }
  const keyIndex = data.indexOf(ACKNOWLEDGEMENTS_KEY);
  if (keyIndex === -1) return null;
  const start = keyIndex + ACKNOWLEDGEMENTS_KEY.length;
  if (data[start] !== OPEN_BRACE) return null;
  let inString = false;
  for (let index = start + 1; index < data.length; index++) {
    const byte = data[index];
    if (inString) {
      if (byte === BACKSLASH) index++;
      else if (byte === QUOTE) inString = false;
    } else if (byte === QUOTE) {
      inString = true;
    } else if (byte === CLOSE_BRACE) {
      return JSON.parse(data.toString("utf8", start, index + 1));
    }
  }
  return null;
}

export function decodeSocketMessage(data) {
  const acknowledgements = extractSnapshotAcknowledgements(data);
  if (acknowledgements !== null) {
    return {
      message: {
        message: {
          lastProcessedInputSequences: acknowledgements,
          type: "snapshot",
        },
        type: "serverMessage",
      },
      snapshot: true,
    };
  }
  const message = JSON.parse(data.toString());
  if (
    message?.type === "serverMessage" &&
    message.message?.type === "snapshot"
  ) {
    throw new Error(
      "Snapshot did not match the expected wire shape. The server " +
        "serialization changed; update extractSnapshotAcknowledgements " +
        "before measuring, because results would not be comparable.",
    );
  }
  return { message, snapshot: false };
}

export function summarizeGeneratorSamples(samples, logicalCores) {
  return {
    cpuUtilizationPercent: summarizeNumbers(
      samples.map((sample) => sample.cpuUtilizationPercent),
    ),
    eventLoopDelayMillis: {
      max: summarizeNumbers(samples.map((sample) => sample.eventLoopDelayMax)),
      p99: summarizeNumbers(samples.map((sample) => sample.eventLoopDelayP99)),
    },
    logicalCores,
    rssBytes: summarizeNumbers(samples.map((sample) => sample.rssBytes)),
  };
}

export function deriveGeneratorSaturation(generator, thresholds) {
  const reasons = [];
  const cpuCeiling = 100;
  if (generator.cpuUtilizationPercent.p50 >= cpuCeiling * thresholds.cpuRatio) {
    reasons.push(
      `load generator CPU p50 ${generator.cpuUtilizationPercent.p50.toFixed(0)}% of one core`,
    );
  }
  if (generator.eventLoopDelayMillis.p99.max > thresholds.eventLoopMillis) {
    reasons.push(
      `load generator event-loop p99 ${generator.eventLoopDelayMillis.p99.max.toFixed(2)}ms exceeds ${thresholds.eventLoopMillis}ms`,
    );
  }
  return { reasons, saturated: reasons.length > 0 };
}

export function generatorLatencyFloorMillis(generator) {
  return generator.eventLoopDelayMillis.p99.max;
}

export function summarizeServerReports(reports, gameIds) {
  const games = [];
  for (const gameId of gameIds) {
    const samples = reports.flatMap((report) =>
      report.games.filter((game) => game.gameId === gameId),
    );
    games.push({
      broadcastLoopDurationMillisP99: summarizeNumbers(
        samples.map((sample) => sample.broadcastLoopDurationMillisP99),
      ),
      gameId,
      requestedSimulationMillisPerSecond: summarizeNumbers(
        samples.map((sample) => sample.requestedSimulationMillisPerSecond),
      ),
      simulationBacklogMillis: summarizeNumbers(
        samples.map((sample) => sample.simulationBacklogMillis),
      ),
      simulationMillisPerSecond: summarizeNumbers(
        samples.map((sample) => sample.simulationMillisPerSecond),
      ),
      simulationThroughputRatio: summarizeNumbers(
        samples.map((sample) => sample.simulationThroughputRatio),
      ),
      snapshotRateHz: summarizeNumbers(
        samples.map((sample) => sample.snapshotRateHz),
      ),
      snapshotSerializeDurationMillisP99: summarizeNumbers(
        samples.map((sample) => sample.snapshotSerializeDurationMillisP99),
      ),
      snapshotStepDurationMillisP99: summarizeNumbers(
        samples.map((sample) => sample.snapshotStepDurationMillisP99),
      ),
      snapshotWireBytesPerSecond: summarizeNumbers(
        samples.map((sample) => sample.snapshotWireBytesPerSecond),
      ),
    });
  }

  return {
    eventLoopDelayMillisP99: summarizeNumbers(
      reports.map((report) => report.eventLoop.p99),
    ),
    games,
    processCpuUtilizationPercent: summarizeNumbers(
      reports.map((report) => report.process.cpuUtilizationPercent),
    ),
    processHeapUsedBytes: summarizeNumbers(
      reports.map((report) => report.process.heapUsedBytes),
    ),
    processRssBytes: summarizeNumbers(
      reports.map((report) => report.process.rssBytes),
    ),
  };
}

export function summarizeRuns(runs) {
  const successfulRuns = runs.filter((run) => run.errors.length === 0);
  return {
    failedRuns: runs.length - successfulRuns.length,
    inputAckLatencyMillisP99: summarizeNumbers(
      successfulRuns.map((run) => run.client.inputAckLatencyMillis.p99),
    ),
    pendingInputAcks: summarizeNumbers(
      runs.map((run) => run.client.pendingInputAcks),
    ),
    snapshotInterArrivalMillisP99: summarizeNumbers(
      successfulRuns.map((run) => run.client.snapshotInterArrivalMillis.p99),
    ),
    successfulRuns: successfulRuns.length,
  };
}

export function parseNonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return parsed;
}

export function parseNonNegativeNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative number`);
  }
  return parsed;
}

export function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

export function parsePositiveNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive number`);
  }
  return parsed;
}

function percentile(sortedValues, rank) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil(sortedValues.length * rank) - 1,
  );
  return sortedValues[index];
}
