import type {
  SnapshotMessage,
  SolitudeGameId,
} from "@solitude/protocol/protocol";
import { describe, expect, it } from "vitest";
import { createNoopSolitudeServerMetrics } from "../metrics";
import {
  createSolitudeGameTicker,
  type SolitudeGameTickPolicy,
  type SolitudeGameTickerClock,
} from "../ticker";

describe("Solitude game ticker", () => {
  it("steps running games and emits snapshots", () => {
    const clock = createManualClock();
    const snapshots: SnapshotMessage[] = [];
    const transport = createTransportStub({
      "game:1": [createSnapshot("game:1", 1), createSnapshot("game:1", 2)],
    });
    const ticker = createSolitudeGameTicker({
      clock,
      metrics: createNoopSolitudeServerMetrics(),
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      policy: createPolicy({
        broadcastIntervalMillis: 250,
        simulationMillisPerWallMillis: 4,
        simulationStepMillis: 1000,
      }),
      transport,
    });

    ticker.runGame({ gameId: "game:1" });
    clock.advance(250);
    clock.tick(0);
    clock.advance(250);
    clock.tick(0);

    expect(snapshots.map((snapshot) => snapshot.tick)).toEqual([1, 2]);
    expect(transport.steps).toEqual([
      {
        dtMillis: 1000,
        gameId: "game:1",
        inputTimeWindow: {
          controlDurationMillis: 250,
          endMillis: 250,
          simulationMillisPerWallMillis: 4,
          startMillis: 0,
        },
      },
      {
        dtMillis: 1000,
        gameId: "game:1",
        inputTimeWindow: {
          controlDurationMillis: 250,
          endMillis: 500,
          simulationMillisPerWallMillis: 4,
          startMillis: 250,
        },
      },
    ]);
  });

  it("replaces existing game loops", () => {
    const clock = createManualClock();
    const ticker = createSolitudeGameTicker({
      clock,
      metrics: createNoopSolitudeServerMetrics(),
      onSnapshot: () => {},
      policy: createPolicy({
        broadcastIntervalMillis: 250,
        simulationMillisPerWallMillis: 4,
        simulationStepMillis: 1000,
      }),
      transport: createTransportStub({ "game:1": [] }),
    });

    ticker.runGame({ gameId: "game:1" });
    ticker.runGame({ gameId: "game:1" });

    expect(clock.timers[0]?.cleared).toBe(true);
    expect(clock.timers[1]?.intervalMillis).toBe(250);
    expect(ticker.isRunning("game:1")).toBe(true);
  });

  it("stops loops when a game cannot be stepped", () => {
    const clock = createManualClock();
    const ticker = createSolitudeGameTicker({
      clock,
      metrics: createNoopSolitudeServerMetrics(),
      onSnapshot: () => {},
      policy: createPolicy({
        broadcastIntervalMillis: 250,
        simulationMillisPerWallMillis: 4,
        simulationStepMillis: 1000,
      }),
      transport: createTransportStub({}),
    });

    ticker.runGame({ gameId: "game:missing" });
    clock.advance(250);
    clock.tick(0);

    expect(ticker.isRunning("game:missing")).toBe(false);
    expect(clock.timers[0]?.cleared).toBe(true);
  });

  it("stops all running loops", () => {
    const clock = createManualClock();
    const ticker = createSolitudeGameTicker({
      clock,
      metrics: createNoopSolitudeServerMetrics(),
      onSnapshot: () => {},
      policy: createPolicy({
        broadcastIntervalMillis: 250,
        simulationMillisPerWallMillis: 4,
        simulationStepMillis: 1000,
      }),
      transport: createTransportStub({ "game:1": [], "game:2": [] }),
    });

    ticker.runGame({ gameId: "game:1" });
    ticker.runGame({ gameId: "game:2" });
    ticker.stopAll();

    expect(ticker.isRunning("game:1")).toBe(false);
    expect(ticker.isRunning("game:2")).toBe(false);
    expect(clock.timers.every((timer) => timer.cleared)).toBe(true);
  });

  it("runs due fixed simulation substeps before emitting one snapshot", () => {
    const clock = createManualClock();
    const snapshots: SnapshotMessage[] = [];
    const transport = createTransportStub({
      "game:1": [
        createSnapshot("game:1", 1),
        createSnapshot("game:1", 2),
        createSnapshot("game:1", 3),
      ],
    });
    const ticker = createSolitudeGameTicker({
      clock,
      metrics: createNoopSolitudeServerMetrics(),
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      policy: createPolicy({
        broadcastIntervalMillis: 250,
        simulationMillisPerWallMillis: 0.4,
        simulationStepMillis: 40,
      }),
      transport,
    });

    ticker.runGame({ gameId: "game:1" });
    clock.advance(250);
    clock.tick(0);

    expect(snapshots.map((snapshot) => snapshot.tick)).toEqual([2]);
    expect(transport.steps).toEqual([
      {
        dtMillis: 40,
        gameId: "game:1",
        inputTimeWindow: {
          controlDurationMillis: 40,
          endMillis: 100,
          simulationMillisPerWallMillis: 0.4,
          startMillis: 0,
        },
      },
      {
        dtMillis: 40,
        gameId: "game:1",
        inputTimeWindow: {
          controlDurationMillis: 40,
          endMillis: 200,
          simulationMillisPerWallMillis: 0.4,
          startMillis: 100,
        },
      },
    ]);
  });

  it("catches up simulation work after delayed clock intervals", () => {
    const clock = createManualClock();
    const snapshots: SnapshotMessage[] = [];
    const transport = createTransportStub({
      "game:1": [
        createSnapshot("game:1", 1),
        createSnapshot("game:1", 2),
        createSnapshot("game:1", 3),
        createSnapshot("game:1", 4),
      ],
    });
    const ticker = createSolitudeGameTicker({
      clock,
      metrics: createNoopSolitudeServerMetrics(),
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      policy: createPolicy({
        broadcastIntervalMillis: 250,
        simulationMillisPerWallMillis: 1,
        simulationStepMillis: 125,
      }),
      transport,
    });

    ticker.runGame({ gameId: "game:1" });
    clock.advance(500);
    clock.tick(0);

    expect(snapshots.map((snapshot) => snapshot.tick)).toEqual([4]);
    expect(transport.steps).toEqual([
      {
        dtMillis: 125,
        gameId: "game:1",
        inputTimeWindow: {
          controlDurationMillis: 125,
          endMillis: 125,
          simulationMillisPerWallMillis: 1,
          startMillis: 0,
        },
      },
      {
        dtMillis: 125,
        gameId: "game:1",
        inputTimeWindow: {
          controlDurationMillis: 125,
          endMillis: 250,
          simulationMillisPerWallMillis: 1,
          startMillis: 125,
        },
      },
      {
        dtMillis: 125,
        gameId: "game:1",
        inputTimeWindow: {
          controlDurationMillis: 125,
          endMillis: 375,
          simulationMillisPerWallMillis: 1,
          startMillis: 250,
        },
      },
      {
        dtMillis: 125,
        gameId: "game:1",
        inputTimeWindow: {
          controlDurationMillis: 125,
          endMillis: 500,
          simulationMillisPerWallMillis: 1,
          startMillis: 375,
        },
      },
    ]);
  });

  it("accumulates short intervals until one fixed simulation step is due", () => {
    const clock = createManualClock();
    const snapshots: SnapshotMessage[] = [];
    const transport = createTransportStub({
      "game:1": [createSnapshot("game:1", 1)],
    });
    const ticker = createSolitudeGameTicker({
      clock,
      metrics: createNoopSolitudeServerMetrics(),
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      policy: createPolicy({
        broadcastIntervalMillis: 250,
        simulationMillisPerWallMillis: 1,
        simulationStepMillis: 25,
      }),
      transport,
    });

    ticker.runGame({ gameId: "game:1" });
    clock.advance(10);
    clock.tick(0);
    clock.advance(15);
    clock.tick(0);

    expect(snapshots.map((snapshot) => snapshot.tick)).toEqual([1]);
    expect(transport.steps).toEqual([
      {
        dtMillis: 25,
        gameId: "game:1",
        inputTimeWindow: {
          controlDurationMillis: 25,
          endMillis: 25,
          simulationMillisPerWallMillis: 1,
          startMillis: 0,
        },
      },
    ]);
  });

  it("updates simulation rate for subsequent steps", () => {
    const clock = createManualClock();
    const transport = createTransportStub({
      "game:1": [createSnapshot("game:1", 1), createSnapshot("game:1", 2)],
    });
    const ticker = createSolitudeGameTicker({
      clock,
      metrics: createNoopSolitudeServerMetrics(),
      onSnapshot: () => {},
      policy: createPolicy({
        broadcastIntervalMillis: 250,
        simulationMillisPerWallMillis: 1,
        simulationStepMillis: 1000,
      }),
      transport,
    });

    ticker.runGame({ gameId: "game:1" });
    clock.advance(500);
    clock.tick(0);
    ticker.setSimulationMillisPerWallMillis(4);
    clock.advance(250);
    clock.tick(1);

    expect(ticker.getSimulationMillisPerWallMillis()).toBe(4);
    expect(transport.steps).toEqual([
      {
        dtMillis: 1000,
        gameId: "game:1",
        inputTimeWindow: {
          controlDurationMillis: 250,
          endMillis: 750,
          simulationMillisPerWallMillis: 4,
          startMillis: 500,
        },
      },
    ]);
  });
});

function createPolicy(policy: SolitudeGameTickPolicy): SolitudeGameTickPolicy {
  return policy;
}

interface ManualTimer {
  callback: () => void;
  cleared: boolean;
  intervalMillis: number;
}

function createManualClock(): SolitudeGameTickerClock<ManualTimer> & {
  advance: (dtMillis: number) => void;
  tick: (index: number) => void;
  timers: ManualTimer[];
} {
  const timers: ManualTimer[] = [];
  let nowMillis = 0;
  return {
    advance: (dtMillis) => {
      nowMillis += dtMillis;
    },
    clearInterval: (timer) => {
      timer.cleared = true;
    },
    nowMillis: () => nowMillis,
    setInterval: (callback, intervalMillis) => {
      const timer = { callback, cleared: false, intervalMillis };
      timers.push(timer);
      return timer;
    },
    tick: (index) => {
      const timer = timers[index];
      if (!timer || timer.cleared) return;
      timer.callback();
    },
    timers,
  };
}

function createTransportStub(
  snapshotsByGameId: Record<SolitudeGameId, SnapshotMessage[]>,
): {
  stepGameWithInputWindow: (
    gameId: SolitudeGameId,
    dtMillis: number,
    inputTimeWindow: {
      controlDurationMillis: number;
      endMillis: number;
      simulationMillisPerWallMillis: number;
      startMillis: number;
    },
  ) => SnapshotMessage | null;
  steps: Array<{
    dtMillis: number;
    gameId: SolitudeGameId;
    inputTimeWindow: {
      controlDurationMillis: number;
      endMillis: number;
      simulationMillisPerWallMillis: number;
      startMillis: number;
    };
  }>;
} {
  const steps: Array<{
    dtMillis: number;
    gameId: SolitudeGameId;
    inputTimeWindow: {
      controlDurationMillis: number;
      endMillis: number;
      simulationMillisPerWallMillis: number;
      startMillis: number;
    };
  }> = [];
  return {
    stepGameWithInputWindow: (gameId, dtMillis, inputTimeWindow) => {
      steps.push({ dtMillis, gameId, inputTimeWindow });
      return snapshotsByGameId[gameId]?.shift() ?? null;
    },
    steps,
  };
}

function createSnapshot(gameId: SolitudeGameId, tick: number): SnapshotMessage {
  return {
    type: "snapshot",
    entities: [],
    gameId,
    lastProcessedInputSequences: {},
    modelVersion: 1,
    sequence: tick,
    simulationTimeMillis: tick * 1000,
    tick,
  };
}
