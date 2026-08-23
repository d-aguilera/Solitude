import { summarizeNumbers } from "./server-load-helpers.mjs";

export const broadcastIntervalMillis = 1000 / 60;
export const provisionalThresholds = Object.freeze({
  eventLoopDelayMillisP99: broadcastIntervalMillis,
  heapGrowthMinimumBytes: 8 * 1024 * 1024,
  heapGrowthMinimumRatio: 0.05,
  simulationThroughputRatio: 0.99,
  snapshotRateHz: 60 * 0.99,
});

export function analyzeLoadRun(run) {
  const reports = run.serverReports ?? [];
  const trend = reports.map((report, sample) => {
    const games = report.games ?? [];
    return {
      eventLoopDelayMillisP99: report.eventLoop?.p99 ?? 0,
      heapUsedBytes: report.process?.heapUsedBytes ?? 0,
      maximumSimulationBacklogMillis: maximum(
        games.map((game) => game.simulationBacklogMillis),
      ),
      minimumSimulationThroughputRatio: minimum(
        games.map((game) => game.simulationThroughputRatio),
      ),
      minimumSnapshotRateHz: minimum(games.map((game) => game.snapshotRateHz)),
      processCpuUtilizationPercent: report.process?.cpuUtilizationPercent ?? 0,
      sample,
    };
  });
  const gameIds = [
    ...new Set(
      reports.flatMap((report) => report.games.map((game) => game.gameId)),
    ),
  ];
  const perGameMedianThroughput = gameIds.map(
    (gameId) =>
      summarizeNumbers(
        reports.flatMap((report) =>
          report.games
            .filter((game) => game.gameId === gameId)
            .map((game) => game.simulationThroughputRatio),
        ),
      ).p50,
  );
  const perGameMedianSnapshotRate = gameIds.map(
    (gameId) =>
      summarizeNumbers(
        reports.flatMap((report) =>
          report.games
            .filter((game) => game.gameId === gameId)
            .map((game) => game.snapshotRateHz),
        ),
      ).p50,
  );
  const backlogValues = trend.map(
    (sample) => sample.maximumSimulationBacklogMillis,
  );
  const heapValues = trend.map((sample) => sample.heapUsedBytes);
  const backlogGrowth = detectGrowth(backlogValues, broadcastIntervalMillis, 0);
  const firstHeap = heapValues[0] ?? 0;
  const heapGrowth = detectGrowth(
    heapValues,
    Math.max(
      provisionalThresholds.heapGrowthMinimumBytes,
      firstHeap * provisionalThresholds.heapGrowthMinimumRatio,
    ),
    0,
  );
  const reasons = [];
  const warnings = [];
  const minimumMedianThroughput = minimum(perGameMedianThroughput);
  const minimumMedianSnapshotRate = minimum(perGameMedianSnapshotRate);

  if (
    gameIds.length > 0 &&
    minimumMedianThroughput < provisionalThresholds.simulationThroughputRatio
  ) {
    reasons.push("simulation-throughput-below-99-percent");
  }
  if (backlogGrowth.growing) reasons.push("simulation-backlog-growing");
  if (
    gameIds.length > 0 &&
    minimumMedianSnapshotRate < provisionalThresholds.snapshotRateHz
  ) {
    reasons.push("snapshot-cadence-below-99-percent");
  }
  if ((run.client?.pendingInputAcks ?? 0) > 0) {
    reasons.push("pending-input-acknowledgements");
  }
  if (heapGrowth.growing) reasons.push("heap-growing-after-warmup");

  const eventLoopP99 = maximum(
    trend.map((sample) => sample.eventLoopDelayMillisP99),
  );
  if (eventLoopP99 > provisionalThresholds.eventLoopDelayMillisP99) {
    warnings.push("event-loop-p99-exceeds-broadcast-interval");
  }
  if ((run.errors?.length ?? 0) > 0) warnings.push("load-run-failed");

  return {
    backlogGrowth,
    eventLoopDelayMillisP99Maximum: eventLoopP99,
    heapGrowth,
    minimumPerGameMedianSimulationThroughputRatio: minimumMedianThroughput,
    minimumPerGameMedianSnapshotRateHz: minimumMedianSnapshotRate,
    reasons,
    saturated: reasons.length > 0 || (run.errors?.length ?? 0) > 0,
    trend,
    warnings,
  };
}

export function curateLoadRun(run, repetition) {
  const analysis = analyzeLoadRun(run);
  return {
    analysis: {
      backlogGrowth: analysis.backlogGrowth,
      eventLoopDelayMillisP99Maximum: analysis.eventLoopDelayMillisP99Maximum,
      heapGrowth: analysis.heapGrowth,
      minimumPerGameMedianSimulationThroughputRatio:
        analysis.minimumPerGameMedianSimulationThroughputRatio,
      minimumPerGameMedianSnapshotRateHz:
        analysis.minimumPerGameMedianSnapshotRateHz,
      reasons: analysis.reasons,
      saturated: analysis.saturated,
      warnings: analysis.warnings,
    },
    client: run.client,
    durationMillis: run.durationMillis,
    errors: run.errors,
    inputEventsSent: run.inputEventsSent,
    repetition,
    server: aggregateServerSummary(run.serverReports ?? []),
    trend: analysis.trend,
  };
}

export function summarizeBaselineRuns(runs) {
  const successfulRuns = runs.filter((run) => run.errors.length === 0);
  const rankedRuns = [...successfulRuns].sort(
    (left, right) =>
      left.server.processCpuUtilizationPercent.p50 -
      right.server.processCpuUtilizationPercent.p50,
  );
  const medianRun = rankedRuns[Math.floor((rankedRuns.length - 1) / 2)];
  const saturationCount = runs.filter((run) => run.analysis.saturated).length;
  return {
    confirmedSaturation:
      runs.length > 0 && saturationCount >= Math.ceil(runs.length / 2),
    failedRuns: runs.length - successfulRuns.length,
    medianRunSelectionMetric: "process-cpu-utilization-p50",
    medianRunRepetition: medianRun?.repetition ?? null,
    repetitions: runs.length,
    saturationCount,
    successfulRuns: successfulRuns.length,
    worst: {
      broadcastLoopDurationMillisP95: maximum(
        successfulRuns.map(
          (run) => run.server.broadcastLoopDurationMillis.p95.max,
        ),
      ),
      broadcastLoopDurationMillisP99: maximum(
        successfulRuns.map(
          (run) => run.server.broadcastLoopDurationMillis.p99.max,
        ),
      ),
      eventLoopDelayMillisP95: maximum(
        successfulRuns.map((run) => run.server.eventLoopDelayMillis.p95.max),
      ),
      eventLoopDelayMillisP99: maximum(
        successfulRuns.map((run) => run.server.eventLoopDelayMillis.p99.max),
      ),
      inputAckLatencyMillisP95: maximum(
        successfulRuns.map((run) => run.client.inputAckLatencyMillis.p95),
      ),
      inputAckLatencyMillisP99: maximum(
        successfulRuns.map((run) => run.client.inputAckLatencyMillis.p99),
      ),
      snapshotInterArrivalMillisP95: maximum(
        successfulRuns.map((run) => run.client.snapshotInterArrivalMillis.p95),
      ),
      snapshotInterArrivalMillisP99: maximum(
        successfulRuns.map((run) => run.client.snapshotInterArrivalMillis.p99),
      ),
      snapshotSerializeDurationMillisP95: maximum(
        successfulRuns.map(
          (run) => run.server.snapshotSerializeDurationMillis.p95.max,
        ),
      ),
      snapshotSerializeDurationMillisP99: maximum(
        successfulRuns.map(
          (run) => run.server.snapshotSerializeDurationMillis.p99.max,
        ),
      ),
      snapshotStepDurationMillisP95: maximum(
        successfulRuns.map(
          (run) => run.server.snapshotStepDurationMillis.p95.max,
        ),
      ),
      snapshotStepDurationMillisP99: maximum(
        successfulRuns.map(
          (run) => run.server.snapshotStepDurationMillis.p99.max,
        ),
      ),
    },
  };
}

export function aggregateServerSummary(reports) {
  const gameSamples = reports.flatMap((report) => report.games ?? []);
  const processSamples = reports.map((report) => report.process);
  return {
    broadcastLoopDurationMillis: aggregateDurationMetric(
      gameSamples,
      "broadcastLoopDurationMillis",
    ),
    eventLoopDelayMillis: aggregateDurationMetric(
      reports.map((report) => report.eventLoop),
      "",
    ),
    processArrayBuffersBytes: summarizeNumbers(
      processSamples.map((sample) => sample.arrayBuffersBytes),
    ),
    processCpuUtilizationPercent: summarizeNumbers(
      processSamples.map((sample) => sample.cpuUtilizationPercent),
    ),
    processExternalBytes: summarizeNumbers(
      processSamples.map((sample) => sample.externalBytes),
    ),
    processHeapTotalBytes: summarizeNumbers(
      processSamples.map((sample) => sample.heapTotalBytes),
    ),
    processHeapUsedBytes: summarizeNumbers(
      processSamples.map((sample) => sample.heapUsedBytes),
    ),
    processRssBytes: summarizeNumbers(
      processSamples.map((sample) => sample.rssBytes),
    ),
    simulationBacklogMillis: summarizeNumbers(
      gameSamples.map((sample) => sample.simulationBacklogMillis),
    ),
    simulationThroughputRatio: summarizeNumbers(
      gameSamples.map((sample) => sample.simulationThroughputRatio),
    ),
    snapshotRateHz: summarizeNumbers(
      gameSamples.map((sample) => sample.snapshotRateHz),
    ),
    snapshotSerializeDurationMillis: aggregateDurationMetric(
      gameSamples,
      "snapshotSerializeDurationMillis",
    ),
    snapshotStepDurationMillis: aggregateDurationMetric(
      gameSamples,
      "snapshotStepDurationMillis",
    ),
    snapshotWireBytesPerSecond: summarizeNumbers(
      gameSamples.map((sample) => sample.snapshotWireBytesPerSecond),
    ),
  };
}

function aggregateDurationMetric(samples, prefix) {
  const read = (sample, suffix) =>
    sample[prefix ? `${prefix}${suffix}` : suffix.toLowerCase()];
  return {
    avg: summarizeNumbers(samples.map((sample) => read(sample, "Avg"))),
    max: summarizeNumbers(samples.map((sample) => read(sample, "Max"))),
    p50: summarizeNumbers(samples.map((sample) => read(sample, "P50"))),
    p95: summarizeNumbers(samples.map((sample) => read(sample, "P95"))),
    p99: summarizeNumbers(samples.map((sample) => read(sample, "P99"))),
  };
}

export function detectGrowth(values, minimumIncrease, minimumSlope) {
  if (values.length < 3) {
    return { growing: false, increase: 0, slopePerSample: 0 };
  }
  const increase = values.at(-1) - values[0];
  const slopePerSample = linearRegressionSlope(values);
  return {
    growing: increase > minimumIncrease && slopePerSample > minimumSlope,
    increase,
    slopePerSample,
  };
}

function linearRegressionSlope(values) {
  const xMean = (values.length - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / values.length;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < values.length; index++) {
    const xDelta = index - xMean;
    numerator += xDelta * (values[index] - yMean);
    denominator += xDelta * xDelta;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

function maximum(values) {
  return values.length === 0 ? 0 : Math.max(...values);
}

function minimum(values) {
  return values.length === 0 ? 0 : Math.min(...values);
}
