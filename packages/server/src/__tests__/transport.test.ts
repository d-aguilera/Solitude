import { describe, expect, it } from "vitest";
import { createSolitudeInProcessTransport } from "../transport";

describe("Solitude in-process transport", () => {
  it("validates inbound payloads before routing them to sessions", () => {
    const transport = createSolitudeInProcessTransport();

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
    const transport = createSolitudeInProcessTransport();

    expect(
      transport.receive(
        {
          type: "createGame",
          clientId: "client:a",
          sequence: 1,
        },
        1,
      ),
    ).toEqual([
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

    expect(
      transport.receive(
        {
          type: "input",
          clientId: "client:a",
          entityId: "ship:blue",
          gameId: "game:1",
          sequence: 3,
          controls: { burnForward: true, thrust5: true },
        },
        3,
      ),
    ).toEqual([]);

    const snapshot = transport.stepGame("game:1", 1000);
    expect(snapshot?.type).toBe("snapshot");
    expect(snapshot?.tick).toBe(1);
    expect(snapshot?.snapshot.entities.length).toBeGreaterThan(0);
  });
});
