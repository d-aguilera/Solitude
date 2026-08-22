import { describe, expect, it } from "vitest";
import {
  createSeededRandom,
  parseNonNegativeInteger,
  parsePositiveInteger,
  summarizeNumbers,
  summarizeRuns,
  summarizeServerReports,
} from "./server-load-helpers.mjs";

describe("server load helpers", () => {
  it("produces repeatable seeded random values", () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it("summarizes p50, p95, p99, and extrema", () => {
    expect(summarizeNumbers([5, 1, 4, 2, 3])).toEqual({
      avg: 3,
      count: 5,
      max: 5,
      min: 1,
      p50: 3,
      p95: 5,
      p99: 5,
    });
  });

  it("aggregates server samples by independent game", () => {
    const summary = summarizeServerReports(
      [createServerReport(10, 0), createServerReport(20, 5)],
      ["game:1"],
    );
    expect(summary.games[0]).toMatchObject({
      gameId: "game:1",
      simulationBacklogMillis: { avg: 2.5, max: 5 },
      simulationThroughputRatio: { avg: 1 },
    });
    expect(summary.processCpuUtilizationPercent).toMatchObject({
      avg: 15,
      max: 20,
    });
  });

  it("reports failed repetitions and pending acknowledgements", () => {
    const summary = summarizeRuns([
      createRun([], 0, 4),
      createRun(["socket closed"], 3, 100),
    ]);
    expect(summary).toMatchObject({
      failedRuns: 1,
      inputAckLatencyMillisP99: { avg: 4, count: 1 },
      pendingInputAcks: { max: 3 },
      successfulRuns: 1,
    });
  });

  it("validates integer options", () => {
    expect(parsePositiveInteger("8", "games")).toBe(8);
    expect(parseNonNegativeInteger("0", "seed")).toBe(0);
    expect(() => parsePositiveInteger("0", "games")).toThrow(
      "--games must be a positive integer",
    );
  });
});

function createRun(errors, pendingInputAcks, p99) {
  return {
    client: {
      inputAckLatencyMillis: { p99 },
      pendingInputAcks,
      snapshotInterArrivalMillis: { p99 },
    },
    errors,
  };
}

function createServerReport(cpu, backlog) {
  return {
    eventLoop: { p99: 1 },
    games: [
      {
        broadcastLoopDurationMillisP99: 1,
        gameId: "game:1",
        requestedSimulationMillisPerSecond: 1000,
        simulationBacklogMillis: backlog,
        simulationMillisPerSecond: 1000,
        simulationThroughputRatio: 1,
        snapshotRateHz: 60,
        snapshotSerializeDurationMillisP99: 1,
        snapshotStepDurationMillisP99: 1,
        snapshotWireBytesPerSecond: 100,
      },
    ],
    process: {
      cpuUtilizationPercent: cpu,
      heapUsedBytes: 100,
      rssBytes: 200,
    },
  };
}
