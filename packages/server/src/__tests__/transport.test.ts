import { describe, expect, it } from "vitest";
import { createDefaultTestInProcessTransport } from "./testServerDefaults";

describe("Solitude in-process transport", () => {
  it("validates inbound payloads before routing them to sessions", () => {
    const transport = createDefaultTestInProcessTransport();

    expect(transport.receive({ type: "createGame" }, 99)).toEqual([
      {
        type: "error",
        code: "invalidMessage",
        message: "Invalid client message",
        sequence: 99,
      },
    ]);
  });

  it("routes valid client messages and steps games", () => {
    const transport = createDefaultTestInProcessTransport();

    expect(
      withoutGameModels(
        transport.receive(
          {
            type: "createGame",
            clientId: "client:a",
            sequence: 1,
          },
          1,
        ),
      ),
    ).toEqual([
      {
        type: "gameCreated",
        clientId: "client:a",
        gameId: "game:1",
        sequence: 1,
      },
    ]);

    expect(
      withoutGameModels(
        transport.receive(
          {
            type: "joinGame",
            clientId: "client:a",
            gameId: "game:1",
            sequence: 2,
          },
          2,
        ),
      ),
    ).toEqual([
      {
        type: "joined",
        clientId: "client:a",
        entityId: "ship:1",
        gameId: "game:1",
        sequence: 2,
      },
    ]);

    expect(
      transport.receive(
        {
          type: "input",
          clientId: "client:a",
          entityId: "ship:1",
          gameId: "game:1",
          inputSequence: 1,
          sequence: 3,
          controls: { burnForward: true, thrust5: true },
        },
        3,
      ),
    ).toEqual([]);

    const snapshot = transport.stepGame("game:1", 1000);
    expect(snapshot?.type).toBe("snapshot");
    expect(snapshot?.lastProcessedInputSequences).toEqual({ "ship:1": 1 });
    expect(snapshot?.modelVersion).toBe(1);
    expect(snapshot?.simulationTimeMillis).toBe(1000);
    expect(snapshot?.tick).toBe(1);
    expect(snapshot?.entities.length).toBeGreaterThan(0);
  });

  it("lists session games", () => {
    const transport = createDefaultTestInProcessTransport();
    transport.receive(
      {
        type: "createGame",
        clientId: "client:a",
        sequence: 1,
      },
      1,
    );

    expect(transport.listGames()).toEqual([
      {
        assignedEntityIds: [],
        availableEntityIds: [
          "ship:1",
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
        tick: 0,
      },
    ]);
  });

  it("cleans up empty session games", () => {
    const transport = createDefaultTestInProcessTransport();
    transport.receive(
      {
        type: "createGame",
        clientId: "client:a",
        sequence: 1,
      },
      1,
    );
    transport.receive(
      {
        type: "joinGame",
        clientId: "client:a",
        gameId: "game:1",
        sequence: 2,
      },
      2,
    );
    transport.receive(
      {
        type: "leaveGame",
        clientId: "client:a",
        gameId: "game:1",
        sequence: 3,
      },
      3,
    );

    expect(transport.cleanupGames()).toEqual(["game:1"]);
    expect(transport.listGames()).toEqual([]);
  });
});

function withoutGameModels(messages: unknown[]): unknown[] {
  return messages.filter(
    (message) =>
      !(typeof message === "object" && message !== null && "type" in message
        ? message.type === "gameModel"
        : false),
  );
}
