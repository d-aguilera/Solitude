import type { ControlInput } from "@solitude/engine/plugin";
import type {
  RuntimeWorldSnapshot,
  WorldAndScene,
} from "@solitude/engine/runtime";
import type { EntityId } from "@solitude/engine/world";
import { describe, expect, it } from "vitest";
import type { SolitudeServerGame } from "../runtime";
import {
  createSolitudeSessionManager,
  type SolitudeSessionManagerOptions,
} from "../sessions";

describe("Solitude session manager", () => {
  it("creates a game and assigns the creator to the first ship", () => {
    const manager = createSolitudeSessionManager();

    const messages = manager.handleMessage({
      type: "createGame",
      clientId: "client:a",
      sequence: 1,
    });

    expect(messages).toEqual([
      {
        type: "gameCreated",
        clientId: "client:a",
        gameId: "game:1",
        sequence: 1,
      },
      {
        type: "joined",
        clientId: "client:a",
        entityId: "ship:blue",
        gameId: "game:1",
        sequence: 2,
      },
    ]);
  });

  it("joins additional clients to available ships and rejects overflow", () => {
    const manager = createSolitudeSessionManager();
    manager.handleMessage({
      type: "createGame",
      clientId: "client:a",
      sequence: 1,
    });

    expect(
      manager.handleMessage({
        type: "joinGame",
        clientId: "client:b",
        gameId: "game:1",
        sequence: 3,
      }),
    ).toEqual([
      {
        type: "joined",
        clientId: "client:b",
        entityId: "ship:red",
        gameId: "game:1",
        sequence: 3,
      },
    ]);
    expect(
      manager.handleMessage({
        type: "joinGame",
        clientId: "client:c",
        gameId: "game:1",
        sequence: 4,
      }),
    ).toEqual([
      {
        type: "error",
        code: "gameFull",
        message: "Game is full: game:1",
        sequence: 4,
      },
    ]);
  });

  it("releases a client's assigned ship when the client leaves", () => {
    const manager = createSolitudeSessionManager();
    manager.handleMessage({
      type: "createGame",
      clientId: "client:a",
      sequence: 1,
    });
    manager.handleMessage({
      type: "joinGame",
      clientId: "client:b",
      gameId: "game:1",
      sequence: 3,
    });

    manager.handleMessage({
      type: "leaveGame",
      clientId: "client:a",
      gameId: "game:1",
      sequence: 4,
    });

    expect(manager.listGames()).toEqual([
      {
        assignedEntityIds: ["ship:red"],
        availableEntityIds: ["ship:blue"],
        gameId: "game:1",
        maxClients: 2,
        tick: 0,
      },
    ]);
    expect(
      manager.handleMessage({
        type: "joinGame",
        clientId: "client:c",
        gameId: "game:1",
        sequence: 5,
      }),
    ).toEqual([
      {
        type: "joined",
        clientId: "client:c",
        entityId: "ship:blue",
        gameId: "game:1",
        sequence: 5,
      },
    ]);
  });

  it("lists games with assigned and available entity ids", () => {
    const manager = createSolitudeSessionManager();
    manager.handleMessage({
      type: "createGame",
      clientId: "client:a",
      sequence: 1,
    });

    expect(manager.listGames()).toEqual([
      {
        assignedEntityIds: ["ship:blue"],
        availableEntityIds: ["ship:red"],
        gameId: "game:1",
        maxClients: 2,
        tick: 0,
      },
    ]);

    manager.handleMessage({
      type: "joinGame",
      clientId: "client:b",
      gameId: "game:1",
      sequence: 3,
    });
    manager.stepGame("game:1", 1000);

    expect(manager.listGames()).toEqual([
      {
        assignedEntityIds: ["ship:blue", "ship:red"],
        availableEntityIds: [],
        gameId: "game:1",
        maxClients: 2,
        tick: 1,
      },
    ]);
  });

  it("accepts assigned input and emits a snapshot on step", () => {
    const manager = createSolitudeSessionManager();
    manager.handleMessage({
      type: "createGame",
      clientId: "client:a",
      sequence: 1,
    });

    expect(
      manager.handleMessage({
        type: "input",
        clientId: "client:a",
        entityId: "ship:blue",
        gameId: "game:1",
        sequence: 3,
        controls: { burnForward: true, thrust5: true },
      }),
    ).toEqual([]);

    const snapshot = manager.stepGame("game:1", 1000);
    expect(snapshot?.type).toBe("snapshot");
    expect(snapshot?.gameId).toBe("game:1");
    expect(snapshot?.sequence).toBe(3);
    expect(snapshot?.tick).toBe(1);
    expect(snapshot?.snapshot.entities.length).toBeGreaterThan(0);
  });

  it("retains assigned input across steps and merges later patches", () => {
    const game = createRecordingGame();
    const manager = createSolitudeSessionManager(createTestOptions(game));
    manager.handleMessage({
      type: "createGame",
      clientId: "client:a",
      sequence: 1,
    });

    manager.handleMessage({
      type: "input",
      clientId: "client:a",
      entityId: "ship:blue",
      gameId: "game:1",
      sequence: 3,
      controls: { burnForward: true, thrust5: true },
    });
    manager.stepGame("game:1", 1000);
    manager.stepGame("game:1", 1000);

    expect(game.controlInputsByStep).toEqual([
      {
        controls: [["ship:blue", { burnForward: true, thrust5: true }]],
        dtMillis: 1000,
      },
      {
        controls: [["ship:blue", { burnForward: true, thrust5: true }]],
        dtMillis: 1000,
      },
    ]);

    manager.handleMessage({
      type: "input",
      clientId: "client:a",
      entityId: "ship:blue",
      gameId: "game:1",
      sequence: 4,
      controls: { burnForward: false },
    });
    manager.stepGame("game:1", 1000);

    expect(game.controlInputsByStep[2]).toEqual({
      controls: [["ship:blue", { burnForward: false, thrust5: true }]],
      dtMillis: 1000,
    });
  });

  it("latches thrust level input instead of treating number keys as held", () => {
    const game = createRecordingGame();
    const manager = createSolitudeSessionManager(createTestOptions(game));
    manager.handleMessage({
      type: "createGame",
      clientId: "client:a",
      sequence: 1,
    });

    manager.handleMessage({
      type: "input",
      clientId: "client:a",
      entityId: "ship:blue",
      gameId: "game:1",
      sequence: 3,
      controls: { thrust9: true },
    });
    manager.handleMessage({
      type: "input",
      clientId: "client:a",
      entityId: "ship:blue",
      gameId: "game:1",
      sequence: 4,
      controls: { thrust9: false },
    });
    manager.stepGame("game:1", 1000);

    expect(game.controlInputsByStep[0]).toEqual({
      controls: [["ship:blue", { thrust9: true }]],
      dtMillis: 1000,
    });

    manager.handleMessage({
      type: "input",
      clientId: "client:a",
      entityId: "ship:blue",
      gameId: "game:1",
      sequence: 5,
      controls: { thrust3: true },
    });
    manager.stepGame("game:1", 1000);

    expect(game.controlInputsByStep[1]).toEqual({
      controls: [["ship:blue", { thrust3: true }]],
      dtMillis: 1000,
    });
  });

  it("applies brief press-and-release input on the next step", () => {
    const game = createRecordingGame();
    const manager = createSolitudeSessionManager(createTestOptions(game));
    manager.handleMessage({
      type: "createGame",
      clientId: "client:a",
      sequence: 1,
    });

    manager.handleMessage({
      type: "input",
      clientId: "client:a",
      entityId: "ship:blue",
      gameId: "game:1",
      sequence: 3,
      controls: { yawLeft: true },
    });
    manager.handleMessage({
      type: "input",
      clientId: "client:a",
      entityId: "ship:blue",
      gameId: "game:1",
      sequence: 4,
      controls: { yawLeft: false },
    });
    manager.stepGame("game:1", 1000);
    manager.stepGame("game:1", 1000);

    expect(game.controlInputsByStep).toEqual([
      { controls: [["ship:blue", { yawLeft: true }]], dtMillis: 1000 },
      { controls: [["ship:blue", { yawLeft: false }]], dtMillis: 1000 },
    ]);
  });

  it("splits timed steps around input edges", () => {
    let nowMillis = 0;
    const game = createRecordingGame();
    const manager = createSolitudeSessionManager(
      createTestOptions(game, () => nowMillis),
    );
    manager.handleMessage({
      type: "createGame",
      clientId: "client:a",
      sequence: 1,
    });

    nowMillis = 10;
    manager.handleMessage({
      type: "input",
      clientId: "client:a",
      entityId: "ship:blue",
      gameId: "game:1",
      sequence: 3,
      controls: { yawLeft: true },
    });
    nowMillis = 15;
    manager.handleMessage({
      type: "input",
      clientId: "client:a",
      entityId: "ship:blue",
      gameId: "game:1",
      sequence: 4,
      controls: { yawLeft: false },
    });
    manager.stepGameWithInputWindow("game:1", 25, {
      endMillis: 25,
      startMillis: 0,
    });

    expect(game.controlInputsByStep).toEqual([
      { controls: [], dtMillis: 10 },
      { controls: [["ship:blue", { yawLeft: true }]], dtMillis: 5 },
      { controls: [["ship:blue", { yawLeft: false }]], dtMillis: 10 },
    ]);
  });

  it("clears held input when the assigned client leaves", () => {
    const game = createRecordingGame();
    const manager = createSolitudeSessionManager(createTestOptions(game));
    manager.handleMessage({
      type: "createGame",
      clientId: "client:a",
      sequence: 1,
    });
    manager.handleMessage({
      type: "input",
      clientId: "client:a",
      entityId: "ship:blue",
      gameId: "game:1",
      sequence: 3,
      controls: { burnForward: true },
    });

    manager.handleMessage({
      type: "leaveGame",
      clientId: "client:a",
      gameId: "game:1",
      sequence: 4,
    });
    manager.stepGame("game:1", 1000);

    expect(game.controlInputsByStep).toEqual([
      { controls: [], dtMillis: 1000 },
    ]);
  });

  it("removes games with no assigned clients during cleanup", () => {
    const manager = createSolitudeSessionManager();
    manager.handleMessage({
      type: "createGame",
      clientId: "client:a",
      sequence: 1,
    });

    expect(manager.cleanupGames()).toEqual([]);

    manager.handleMessage({
      type: "leaveGame",
      clientId: "client:a",
      gameId: "game:1",
      sequence: 3,
    });

    expect(manager.cleanupGames()).toEqual(["game:1"]);
    expect(manager.listGames()).toEqual([]);
    expect(manager.stepGame("game:1", 1000)).toBeNull();
  });

  it("rejects input for entities not assigned to the client", () => {
    const manager = createSolitudeSessionManager();
    manager.handleMessage({
      type: "createGame",
      clientId: "client:a",
      sequence: 1,
    });

    expect(
      manager.handleMessage({
        type: "input",
        clientId: "client:a",
        entityId: "ship:red",
        gameId: "game:1",
        sequence: 3,
        controls: { burnForward: true },
      }),
    ).toEqual([
      {
        type: "error",
        code: "entityNotAssigned",
        message: "Entity is not assigned to client: ship:red",
        sequence: 3,
      },
    ]);
  });
});

interface RecordingGame extends SolitudeServerGame {
  controlInputsByStep: Array<{
    controls: Array<[EntityId, Partial<ControlInput>]>;
    dtMillis: number;
  }>;
}

function createRecordingGame(): RecordingGame {
  const snapshot: RuntimeWorldSnapshot = { entities: [] };
  const game: RecordingGame = {
    controlInputsByStep: [],
    snapshot,
    worldAndScene: {} as WorldAndScene,
    step: (dtMillis, controlInputsByEntityId) => {
      const controlInputs: Array<[EntityId, Partial<ControlInput>]> = [];
      for (const [entityId, controls] of controlInputsByEntityId) {
        controlInputs.push([entityId, { ...controls }]);
      }
      controlInputs.sort(([left], [right]) => left.localeCompare(right));
      game.controlInputsByStep.push({ controls: controlInputs, dtMillis });
      return snapshot;
    },
  };
  return game;
}

function createTestOptions(
  game: SolitudeServerGame,
  nowMillis: () => number = Date.now,
): SolitudeSessionManagerOptions {
  return {
    assignableEntityIds: ["ship:blue", "ship:red"],
    createGame: () => game,
    nowMillis,
  };
}
