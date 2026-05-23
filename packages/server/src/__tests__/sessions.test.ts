import { describe, expect, it } from "vitest";
import { createSolitudeSessionManager } from "../sessions";

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
