import { describe, expect, it, vi } from "vitest";
import {
  createSolitudeServerMetrics,
  type SolitudeEventLoopDelayMonitor,
  type SolitudeProcessCpuUsage,
} from "../metrics";

describe("Solitude server metrics", () => {
  it("reports precise rolling snapshot, process, and event-loop metrics", () => {
    let nowMillis = 1000;
    const monitor = createEventLoopDelayMonitor();
    const cpuSamples: SolitudeProcessCpuUsage[] = [
      { system: 2000, user: 1000 },
      { system: 12_000, user: 41_000 },
    ];
    const metrics = createSolitudeServerMetrics({
      cpuUsage: () => cpuSamples.shift() ?? { system: 0, user: 0 },
      eventLoopDelayMonitor: monitor,
      memoryUsage: () => ({
        arrayBuffers: 50,
        external: 40,
        heapTotal: 30,
        heapUsed: 20,
        rss: 10,
      }),
      nowMillis: () => nowMillis,
      windowMillis: 1000,
    });

    metrics.recordSnapshotStep({
      durationMillis: 2,
      entityCount: 3,
      gameId: "game:1",
    });
    metrics.recordGameTick({
      broadcastLoopDurationMillis: 2,
      completedSimulationMillis: 1000,
      completedSteps: 1,
      gameId: "game:1",
      requestedSimulationMillis: 1000,
      simulationBacklogMillis: 0,
    });
    metrics.recordSnapshotBroadcast({
      byteLength: 100,
      clientCount: 2,
      gameId: "game:1",
      serializeDurationMillis: 4,
    });
    nowMillis = 1500;
    metrics.recordSnapshotStep({
      durationMillis: 6,
      entityCount: 5,
      gameId: "game:1",
    });
    metrics.recordGameTick({
      broadcastLoopDurationMillis: 6,
      completedSimulationMillis: 1000,
      completedSteps: 1,
      gameId: "game:1",
      requestedSimulationMillis: 2000,
      simulationBacklogMillis: 1000,
    });
    metrics.recordSnapshotBroadcast({
      byteLength: 140,
      clientCount: 1,
      gameId: "game:1",
      serializeDurationMillis: 8,
    });

    const report = metrics.createReport({
      connectedSockets: 2,
      games: [createGameSummary()],
      getClientCount: () => 1,
    });

    expect(report.sockets.connected).toBe(2);
    expect(report.games[0]).toMatchObject({
      broadcastLoopDurationMillisAvg: 4,
      broadcastLoopDurationMillisMax: 6,
      broadcastLoopDurationMillisP50: 2,
      broadcastLoopDurationMillisP95: 6,
      broadcastLoopDurationMillisP99: 6,
      clients: 1,
      entityCountAvg: 4,
      gameId: "game:1",
      running: true,
      requestedSimulationMillisPerSecond: 3000,
      simulationBacklogMillis: 1000,
      simulationMillisPerSecond: 2000,
      simulationStepsPerSecond: 2,
      simulationThroughputRatio: 2 / 3,
      snapshotPayloadBytesAvg: 120,
      snapshotRateHz: 2,
      snapshotSerializeDurationMillisAvg: 6,
      snapshotSerializeDurationMillisMax: 8,
      snapshotSerializeDurationMillisP50: 4,
      snapshotSerializeDurationMillisP95: 8,
      snapshotSerializeDurationMillisP99: 8,
      snapshotStepDurationMillisAvg: 4,
      snapshotStepDurationMillisMax: 6,
      snapshotStepDurationMillisP50: 2,
      snapshotStepDurationMillisP95: 6,
      snapshotStepDurationMillisP99: 6,
      snapshotWireBytesPerSecond: 340,
      tick: 12,
    });
    expect(report.process).toEqual({
      arrayBuffersBytes: 50,
      cpuSystemMillis: 10,
      cpuTotalMillis: 50,
      cpuUserMillis: 40,
      cpuUtilizationPercent: 10,
      cpuWindowMillis: 500,
      externalBytes: 40,
      heapTotalBytes: 30,
      heapUsedBytes: 20,
      rssBytes: 10,
    });
    expect(report.eventLoop).toEqual({
      avg: 4,
      max: 8,
      p50: 2,
      p95: 6,
      p99: 7,
    });
    expect(monitor.enable).toHaveBeenCalledOnce();
    expect(monitor.reset).toHaveBeenCalledOnce();

    metrics.close();
    expect(monitor.disable).toHaveBeenCalledOnce();
  });

  it("retains sub-millisecond samples and reports bounded percentile buckets", () => {
    const metrics = createTestMetrics(() => 1000);

    metrics.recordSnapshotStep({
      durationMillis: 0.123,
      entityCount: 1,
      gameId: "game:1",
    });

    const report = metrics.createReport({
      connectedSockets: 0,
      games: [createGameSummary()],
      getClientCount: () => 0,
    });

    expect(report.games[0]).toMatchObject({
      snapshotStepDurationMillisAvg: 0.123,
      snapshotStepDurationMillisMax: 0.123,
      snapshotStepDurationMillisP50: 0.13,
      snapshotStepDurationMillisP95: 0.13,
      snapshotStepDurationMillisP99: 0.13,
    });
  });

  it("expires old rotating-window samples", () => {
    let nowMillis = 1000;
    const metrics = createTestMetrics(() => nowMillis);

    metrics.recordSnapshotBroadcast({
      byteLength: 100,
      clientCount: 1,
      gameId: "game:1",
      serializeDurationMillis: 1,
    });
    nowMillis = 2500;

    const report = metrics.createReport({
      connectedSockets: 0,
      games: [createGameSummary({ running: false, tick: 0 })],
      getClientCount: () => 0,
    });

    expect(report.games[0]?.snapshotRateHz).toBe(0);
    expect(report.games[0]?.snapshotPayloadBytesAvg).toBe(0);
  });
});

function createTestMetrics(nowMillis: () => number) {
  return createSolitudeServerMetrics({
    cpuUsage: () => ({ system: 0, user: 0 }),
    eventLoopDelayMonitor: createEventLoopDelayMonitor(),
    memoryUsage: () => ({
      arrayBuffers: 0,
      external: 0,
      heapTotal: 0,
      heapUsed: 0,
      rss: 0,
    }),
    nowMillis,
    windowMillis: 1000,
  });
}

function createEventLoopDelayMonitor(): SolitudeEventLoopDelayMonitor {
  return {
    disable: vi.fn(),
    enable: vi.fn(),
    max: 8_000_000,
    mean: 4_000_000,
    percentile: (percentile) => {
      if (percentile === 50) return 2_000_000;
      if (percentile === 95) return 6_000_000;
      return 7_000_000;
    },
    reset: vi.fn(),
  };
}

function createGameSummary(
  overrides: Partial<ReturnType<typeof createGameSummaryBase>> = {},
) {
  return { ...createGameSummaryBase(), ...overrides };
}

function createGameSummaryBase() {
  return {
    assignedEntityIds: ["ship:1"],
    availableEntityIds: [],
    gameId: "game:1",
    maxClients: 1,
    running: true,
    tick: 12,
  };
}
