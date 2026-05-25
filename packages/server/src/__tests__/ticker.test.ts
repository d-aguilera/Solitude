import { describe, expect, it } from "vitest";
import type { SnapshotMessage, SolitudeGameId } from "../protocol";
import {
  createSolitudeGameTicker,
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
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      transport,
    });

    ticker.runGame({
      dtMillis: 1000,
      gameId: "game:1",
      intervalMillis: 250,
      simulationStepMillis: 1000,
    });
    clock.advance(250);
    clock.tick(0);
    clock.advance(250);
    clock.tick(0);

    expect(snapshots.map((snapshot) => snapshot.tick)).toEqual([1, 2]);
    expect(transport.steps).toEqual([
      {
        dtMillis: 1000,
        gameId: "game:1",
        inputTimeWindow: { endMillis: 250, startMillis: 0 },
      },
      {
        dtMillis: 1000,
        gameId: "game:1",
        inputTimeWindow: { endMillis: 500, startMillis: 250 },
      },
    ]);
  });

  it("replaces existing game loops", () => {
    const clock = createManualClock();
    const ticker = createSolitudeGameTicker({
      clock,
      onSnapshot: () => {},
      transport: createTransportStub({ "game:1": [] }),
    });

    ticker.runGame({
      dtMillis: 1000,
      gameId: "game:1",
      intervalMillis: 250,
      simulationStepMillis: 1000,
    });
    ticker.runGame({
      dtMillis: 500,
      gameId: "game:1",
      intervalMillis: 125,
      simulationStepMillis: 500,
    });

    expect(clock.timers[0]?.cleared).toBe(true);
    expect(clock.timers[1]?.intervalMillis).toBe(125);
    expect(ticker.isRunning("game:1")).toBe(true);
  });

  it("pauses loops when a game cannot be stepped", () => {
    const clock = createManualClock();
    const ticker = createSolitudeGameTicker({
      clock,
      onSnapshot: () => {},
      transport: createTransportStub({}),
    });

    ticker.runGame({
      dtMillis: 1000,
      gameId: "game:missing",
      intervalMillis: 250,
      simulationStepMillis: 1000,
    });
    clock.advance(250);
    clock.tick(0);

    expect(ticker.isRunning("game:missing")).toBe(false);
    expect(clock.timers[0]?.cleared).toBe(true);
  });

  it("pauses all running loops", () => {
    const clock = createManualClock();
    const ticker = createSolitudeGameTicker({
      clock,
      onSnapshot: () => {},
      transport: createTransportStub({ "game:1": [], "game:2": [] }),
    });

    ticker.runGame({
      dtMillis: 1000,
      gameId: "game:1",
      intervalMillis: 250,
      simulationStepMillis: 1000,
    });
    ticker.runGame({
      dtMillis: 1000,
      gameId: "game:2",
      intervalMillis: 250,
      simulationStepMillis: 1000,
    });
    ticker.pauseAll();

    expect(ticker.isRunning("game:1")).toBe(false);
    expect(ticker.isRunning("game:2")).toBe(false);
    expect(clock.timers.every((timer) => timer.cleared)).toBe(true);
  });

  it("runs fixed simulation substeps before emitting one snapshot", () => {
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
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      transport,
    });

    ticker.runGame({
      dtMillis: 100,
      gameId: "game:1",
      intervalMillis: 250,
      simulationStepMillis: 40,
    });
    clock.advance(250);
    clock.tick(0);

    expect(snapshots.map((snapshot) => snapshot.tick)).toEqual([3]);
    expect(transport.steps).toEqual([
      {
        dtMillis: 40,
        gameId: "game:1",
        inputTimeWindow: { endMillis: 100, startMillis: 0 },
      },
      {
        dtMillis: 40,
        gameId: "game:1",
        inputTimeWindow: { endMillis: 200, startMillis: 100 },
      },
      {
        dtMillis: 20,
        gameId: "game:1",
        inputTimeWindow: { endMillis: 250, startMillis: 200 },
      },
    ]);
  });
});

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
    inputTimeWindow: { endMillis: number; startMillis: number },
  ) => SnapshotMessage | null;
  steps: Array<{
    dtMillis: number;
    gameId: SolitudeGameId;
    inputTimeWindow: { endMillis: number; startMillis: number };
  }>;
} {
  const steps: Array<{
    dtMillis: number;
    gameId: SolitudeGameId;
    inputTimeWindow: { endMillis: number; startMillis: number };
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
    gameId,
    sequence: tick,
    snapshot: { entities: [] },
    tick,
  };
}
