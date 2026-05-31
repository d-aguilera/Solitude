import type { SolitudeGameId } from "@solitude/protocol/protocol";
import { describe, expect, it } from "vitest";
import { createSolitudeGameRunner } from "../runner";
import type { SolitudeGameTickRequest, SolitudeGameTicker } from "../ticker";
import { createSolitudeInProcessTransport } from "../transport";

describe("Solitude game runner", () => {
  it("starts created games immediately", () => {
    const ticker = createTickerStub();
    const runner = createSolitudeGameRunner({
      ticker,
      transport: createSolitudeInProcessTransport(),
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
        availableEntityIds: ["ship:blue", "ship:red"],
        gameId: "game:1",
        maxClients: 2,
        running: true,
        tick: 0,
      },
    ]);
  });

  it("stops loops for games removed by cleanup", () => {
    const ticker = createTickerStub();
    const runner = createSolitudeGameRunner({
      ticker,
      transport: createSolitudeInProcessTransport(),
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
      transport: createSolitudeInProcessTransport(),
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
