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
    });
    clock.tick(0);
    clock.tick(0);

    expect(snapshots.map((snapshot) => snapshot.tick)).toEqual([1, 2]);
    expect(transport.steps).toEqual([
      { dtMillis: 1000, gameId: "game:1" },
      { dtMillis: 1000, gameId: "game:1" },
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
    });
    ticker.runGame({
      dtMillis: 500,
      gameId: "game:1",
      intervalMillis: 125,
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
    });
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
    });
    ticker.runGame({
      dtMillis: 1000,
      gameId: "game:2",
      intervalMillis: 250,
    });
    ticker.pauseAll();

    expect(ticker.isRunning("game:1")).toBe(false);
    expect(ticker.isRunning("game:2")).toBe(false);
    expect(clock.timers.every((timer) => timer.cleared)).toBe(true);
  });
});

interface ManualTimer {
  callback: () => void;
  cleared: boolean;
  intervalMillis: number;
}

function createManualClock(): SolitudeGameTickerClock<ManualTimer> & {
  tick: (index: number) => void;
  timers: ManualTimer[];
} {
  const timers: ManualTimer[] = [];
  return {
    clearInterval: (timer) => {
      timer.cleared = true;
    },
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
  stepGame: (
    gameId: SolitudeGameId,
    dtMillis: number,
  ) => SnapshotMessage | null;
  steps: Array<{ dtMillis: number; gameId: SolitudeGameId }>;
} {
  const steps: Array<{ dtMillis: number; gameId: SolitudeGameId }> = [];
  return {
    stepGame: (gameId, dtMillis) => {
      steps.push({ dtMillis, gameId });
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
