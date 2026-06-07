import type { SolitudeGameId } from "@solitude/protocol/protocol";
import { describe, expect, it } from "vitest";
import { createSolitudeGameRunner } from "../runner";
import type { SolitudeGameTickRequest, SolitudeGameTicker } from "../ticker";
import { createDefaultTestInProcessTransport } from "./testServerDefaults";

describe("Solitude game runner", () => {
  it("starts created games immediately", () => {
    const ticker = createTickerStub();
    const runner = createSolitudeGameRunner({
      ticker,
      transport: createDefaultTestInProcessTransport(),
    });

    runner.receive(
      {
        type: "createGame",
        clientId: "client:a",
        sequence: 1,
      },
      1,
    );

    expect(ticker.startedGameIds).toEqual(["game:1"]);
    expect(runner.listGames()).toEqual([
      {
        assignedEntityIds: [],
        availableEntityIds: [
          "ship:blue",
          "ship:red",
          "ship:3",
          "ship:4",
          "ship:5",
          "ship:6",
          "ship:7",
          "ship:8",
          "ship:9",
          "ship:10",
          "ship:11",
          "ship:12",
          "ship:13",
          "ship:14",
          "ship:15",
          "ship:16",
        ],
        gameId: "game:1",
        maxClients: 16,
        running: true,
        tick: 0,
      },
    ]);
  });

  it("stops loops for games removed by cleanup", () => {
    const ticker = createTickerStub();
    const runner = createSolitudeGameRunner({
      ticker,
      transport: createDefaultTestInProcessTransport(),
    });

    runner.receive(
      {
        type: "createGame",
        clientId: "client:a",
        sequence: 1,
      },
      1,
    );
    runner.receive(
      {
        type: "joinGame",
        clientId: "client:a",
        gameId: "game:1",
        sequence: 2,
      },
      2,
    );
    runner.receive(
      {
        type: "leaveGame",
        clientId: "client:a",
        gameId: "game:1",
        sequence: 3,
      },
      3,
    );

    expect(ticker.stoppedGameIds).toEqual(["game:1"]);
    expect(runner.listGames()).toEqual([]);
  });

  it("closes every running loop", () => {
    const ticker = createTickerStub();
    const runner = createSolitudeGameRunner({
      ticker,
      transport: createDefaultTestInProcessTransport(),
    });

    runner.receive(
      {
        type: "createGame",
        clientId: "client:a",
        sequence: 1,
      },
      1,
    );
    runner.close();

    expect(ticker.stopAllCount).toBe(1);
    expect(ticker.runningGameIds()).toEqual([]);
  });
});

function createTickerStub(): SolitudeGameTicker & {
  runningGameIds: () => SolitudeGameId[];
  startedGameIds: SolitudeGameId[];
  stopAllCount: number;
  stoppedGameIds: SolitudeGameId[];
} {
  const runningGameIds = new Set<SolitudeGameId>();
  const ticker = {
    isRunning: (gameId: SolitudeGameId) => runningGameIds.has(gameId),
    runGame: (request: SolitudeGameTickRequest) => {
      ticker.startedGameIds.push(request.gameId);
      runningGameIds.add(request.gameId);
    },
    runningGameIds: () => Array.from(runningGameIds),
    startedGameIds: [] as SolitudeGameId[],
    stopAll: () => {
      ticker.stopAllCount++;
      runningGameIds.clear();
    },
    stopAllCount: 0,
    stopGame: (gameId: SolitudeGameId) => {
      ticker.stoppedGameIds.push(gameId);
      runningGameIds.delete(gameId);
    },
    stoppedGameIds: [] as SolitudeGameId[],
  };
  return ticker;
}
