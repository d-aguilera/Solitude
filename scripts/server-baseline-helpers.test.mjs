import { describe, expect, it } from "vitest";
import {
  analyzeLoadRun,
  detectBandGrowth,
  detectGrowth,
  reanalyzeBaselineResult,
  resolvePathAdjustedThresholds,
  summarizeBaselineRuns,
} from "./server-baseline-helpers.mjs";

describe("server baseline helpers", () => {
  it("detects sustained growth rather than a final isolated drop", () => {
    expect(detectGrowth([0, 10, 20, 30], 16, 0)).toMatchObject({
      growing: true,
      increase: 30,
    });
    expect(detectGrowth([0, 30, 20, 5], 16, 0).growing).toBe(false);
  });

  it("does not mistake a stable GC sawtooth for heap growth", () => {
    expect(
      detectBandGrowth([0, 5, 10, 20, 0, 5, 10, 20, 0, 5, 10, 20], 16, 0)
        .growing,
    ).toBe(false);
    expect(
      detectBandGrowth([0, 1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23], 16, 0)
        .growing,
    ).toBe(true);
  });

  it("classifies throughput, backlog, cadence, and ack saturation", () => {
    const run = createRun([
      createReport({ backlog: 0, snapshotRate: 58, throughput: 0.98 }),
      createReport({ backlog: 20, snapshotRate: 58, throughput: 0.98 }),
      createReport({ backlog: 40, snapshotRate: 58, throughput: 0.98 }),
    ]);
    run.client.pendingInputAcks = 2;
    const analysis = analyzeLoadRun(run);
    expect(analysis.saturated).toBe(true);
    expect(analysis.reasons).toEqual([
      "simulation-throughput-below-99-percent",
      "simulation-backlog-growing",
      "snapshot-cadence-below-99-percent",
      "pending-input-acknowledgements",
    ]);
  });

  it("treats event-loop delay as a provisional warning", () => {
    const run = createRun([
      createReport({ eventLoopP99: 20 }),
      createReport({ eventLoopP99: 20 }),
      createReport({ eventLoopP99: 20 }),
    ]);
    const analysis = analyzeLoadRun(run);
    expect(analysis.saturated).toBe(false);
    expect(analysis.warnings).toContain(
      "event-loop-p99-exceeds-broadcast-interval",
    );
  });

  it("warns on observed interaction latency without declaring saturation", () => {
    const run = createRun([createReport(), createReport(), createReport()]);
    run.client.inputAckLatencyMillis.p99 = 51;
    run.client.snapshotInterArrivalMillis.p99 = 51;
    const analysis = analyzeLoadRun(run);
    expect(analysis.saturated).toBe(false);
    expect(analysis.warnings).toEqual([
      "input-ack-p99-exceeds-provisional-warning",
      "snapshot-inter-arrival-p99-exceeds-provisional-warning",
    ]);
  });

  it("confirms saturation in a majority and selects the median CPU run", () => {
    const runs = [
      createCuratedRun(1, 10, false),
      createCuratedRun(2, 50, true),
      createCuratedRun(3, 30, true),
      createCuratedRun(4, 40, true),
      createCuratedRun(5, 20, false),
    ];
    expect(summarizeBaselineRuns(runs)).toMatchObject({
      confirmedSaturation: true,
      medianRunRepetition: 3,
      saturationCount: 3,
    });
  });

  it("reclassifies stored heap trends and scenario summaries", () => {
    const run = createCuratedRun(1, 10, true);
    run.analysis.reasons = ["heap-growing-after-warmup"];
    run.errors = [];
    run.trend = Array.from({ length: 12 }, (_, index) => ({
      heapUsedBytes: [0, 5, 10, 20][index % 4],
    }));
    const result = {
      capacitySweep: [],
      scenarios: [{ runs: [run], summary: {} }],
    };
    reanalyzeBaselineResult(result);
    expect(run.analysis).toMatchObject({ reasons: [], saturated: false });
    expect(result.scenarios[0].summary.confirmedSaturation).toBe(false);
  });
});

function createRun(reports) {
  return {
    client: {
      inputAckLatencyMillis: { p99: 1 },
      pendingInputAcks: 0,
      snapshotInterArrivalMillis: { p99: 17 },
    },
    errors: [],
    serverReports: reports,
  };
}

function createReport({
  backlog = 0,
  eventLoopP99 = 1,
  heap = 100,
  snapshotRate = 60,
  throughput = 1,
} = {}) {
  return {
    eventLoop: {
      avg: eventLoopP99,
      max: eventLoopP99,
      p50: eventLoopP99,
      p95: eventLoopP99,
      p99: eventLoopP99,
    },
    games: [
      {
        broadcastLoopDurationMillisAvg: 1,
        broadcastLoopDurationMillisMax: 1,
        broadcastLoopDurationMillisP50: 1,
        broadcastLoopDurationMillisP95: 1,
        broadcastLoopDurationMillisP99: 1,
        gameId: "game:1",
        simulationBacklogMillis: backlog,
        simulationThroughputRatio: throughput,
        snapshotRateHz: snapshotRate,
        snapshotSerializeDurationMillisAvg: 1,
        snapshotSerializeDurationMillisMax: 1,
        snapshotSerializeDurationMillisP50: 1,
        snapshotSerializeDurationMillisP95: 1,
        snapshotSerializeDurationMillisP99: 1,
        snapshotStepDurationMillisAvg: 1,
        snapshotStepDurationMillisMax: 1,
        snapshotStepDurationMillisP50: 1,
        snapshotStepDurationMillisP95: 1,
        snapshotStepDurationMillisP99: 1,
        snapshotWireBytesPerSecond: 100,
      },
    ],
    process: {
      arrayBuffersBytes: 1,
      cpuUtilizationPercent: 10,
      externalBytes: 1,
      heapTotalBytes: heap,
      heapUsedBytes: heap,
      rssBytes: 200,
    },
  };
}

function createCuratedRun(repetition, cpu, saturated) {
  return {
    analysis: { saturated },
    client: {
      inputAckLatencyMillis: { p95: 1, p99: 1 },
      snapshotInterArrivalMillis: { p95: 17, p99: 17 },
    },
    errors: [],
    repetition,
    server: {
      broadcastLoopDurationMillis: {
        p95: { max: 1 },
        p99: { max: 1 },
      },
      eventLoopDelayMillis: { p95: { max: 1 }, p99: { max: 1 } },
      processCpuUtilizationPercent: { p50: cpu },
      snapshotSerializeDurationMillis: {
        p95: { max: 1 },
        p99: { max: 1 },
      },
      snapshotStepDurationMillis: {
        p95: { max: 1 },
        p99: { max: 1 },
      },
    },
  };
}

describe("path-adjusted thresholds", () => {
  it("leaves loopback thresholds effectively unchanged", () => {
    const thresholds = resolvePathAdjustedThresholds({ p50: 0, p99: 0 });
    expect(thresholds.inputAckLatencyMillisP99Warning).toBe(50);
    expect(thresholds.snapshotInterArrivalMillisP99Warning).toBe(50);
  });

  it("offsets the acknowledgement budget by full path latency", () => {
    const thresholds = resolvePathAdjustedThresholds({ p50: 8, p99: 13 });
    expect(thresholds.inputAckLatencyMillisP99Warning).toBe(63);
  });

  it("offsets inter-arrival by jitter only, since spacing ignores constant latency", () => {
    const thresholds = resolvePathAdjustedThresholds({ p50: 8, p99: 13 });
    expect(thresholds.snapshotInterArrivalMillisP99Warning).toBe(55);
  });

  it("never lowers a threshold when the path summary is empty or inverted", () => {
    expect(
      resolvePathAdjustedThresholds(undefined).inputAckLatencyMillisP99Warning,
    ).toBe(50);
    expect(
      resolvePathAdjustedThresholds({ p50: 13, p99: 8 })
        .snapshotInterArrivalMillisP99Warning,
    ).toBe(50);
  });

  it("leaves server-side thresholds untouched by the network path", () => {
    const thresholds = resolvePathAdjustedThresholds({ p50: 8, p99: 13 });
    expect(thresholds.eventLoopDelayMillisP99).toBe(
      resolvePathAdjustedThresholds({ p50: 0, p99: 0 }).eventLoopDelayMillisP99,
    );
    expect(thresholds.simulationThroughputRatio).toBe(0.99);
  });
});

describe("saturation voting", () => {
  const run = (repetition, { saturated = false, failed = false } = {}) => ({
    analysis: { saturated },
    client: {
      inputAckLatencyMillis: { p95: 1, p99: 1 },
      snapshotInterArrivalMillis: { p95: 1, p99: 1 },
    },
    errors: failed ? ["fetch failed"] : [],
    repetition,
    server: {
      broadcastLoopDurationMillis: { p95: { max: 1 }, p99: { max: 1 } },
      eventLoopDelayMillis: { p95: { max: 1 }, p99: { max: 1 } },
      processCpuUtilizationPercent: { p50: repetition },
      snapshotSerializeDurationMillis: { p95: { max: 1 }, p99: { max: 1 } },
      snapshotStepDurationMillis: { p95: { max: 1 }, p99: { max: 1 } },
    },
  });

  it("does not let transport failures manufacture saturation", () => {
    const summary = summarizeBaselineRuns([
      run(1, { failed: true }),
      run(2, { failed: true }),
      run(3, { failed: true }),
      run(4),
      run(5),
    ]);
    expect(summary.confirmedSaturation).toBe(false);
    expect(summary.saturationCount).toBe(0);
    expect(summary.failedRuns).toBe(3);
  });

  it("refuses to conclude when too few runs are valid", () => {
    const summary = summarizeBaselineRuns([
      run(1, { failed: true }),
      run(2, { failed: true }),
      run(3, { failed: true }),
      run(4, { saturated: true }),
      run(5, { saturated: true }),
    ]);
    expect(summary.inconclusive).toBe(true);
    expect(summary.confirmedSaturation).toBe(false);
  });

  it("confirms saturation on a majority of valid runs", () => {
    const summary = summarizeBaselineRuns([
      run(1, { saturated: true }),
      run(2, { saturated: true }),
      run(3, { saturated: true }),
      run(4),
      run(5),
    ]);
    expect(summary.confirmedSaturation).toBe(true);
    expect(summary.inconclusive).toBe(false);
    expect(summary.saturationVoters).toBe(5);
  });

  it("still confirms when a minority failed and the valid majority saturated", () => {
    const summary = summarizeBaselineRuns([
      run(1, { failed: true }),
      run(2, { saturated: true }),
      run(3, { saturated: true }),
      run(4, { saturated: true }),
      run(5),
    ]);
    expect(summary.confirmedSaturation).toBe(true);
    expect(summary.saturationVoters).toBe(4);
  });
});
