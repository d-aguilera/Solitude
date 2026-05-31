import { describe, expect, it } from "vitest";
import {
  createErrorMessage,
  createGameCreatedMessage,
  createGameModelMessage,
  createJoinedGameMessage,
  createSnapshotMessage,
  isSolitudeClientMessage,
  isSolitudeServerMessage,
  isSolitudeSocketClientMessage,
} from "../protocol";

describe("Solitude protocol", () => {
  it("constructs typed server messages", () => {
    expect(
      createGameCreatedMessage({
        clientId: "client:a",
        gameId: "game:test",
        sequence: 1,
      }),
    ).toEqual({
      type: "gameCreated",
      clientId: "client:a",
      gameId: "game:test",
      sequence: 1,
    });

    expect(
      createJoinedGameMessage({
        clientId: "client:a",
        entityId: "ship:blue",
        gameId: "game:test",
        sequence: 2,
      }).type,
    ).toBe("joined");

    expect(
      createErrorMessage({
        code: "full",
        message: "Game is full",
        sequence: 3,
      }).type,
    ).toBe("error");
  });

  it("recognizes client ingress messages", () => {
    expect(
      isSolitudeClientMessage({
        type: "createGame",
        clientId: "client:a",
        sequence: 1,
      }),
    ).toBe(true);
    expect(
      isSolitudeClientMessage({
        type: "input",
        clientId: "client:a",
        entityId: "ship:blue",
        gameId: "game:test",
        sequence: 2,
        controls: { burnForward: true },
      }),
    ).toBe(true);
    expect(
      isSolitudeClientMessage({
        type: "input",
        clientId: "client:a",
        entityId: "ship:blue",
        gameId: "game:test",
        sequence: 2,
        controls: null,
      }),
    ).toBe(false);
  });

  it("recognizes server egress messages", () => {
    const snapshotMessage = createSnapshotMessage({
      entities: [],
      gameId: "game:test",
      modelVersion: 2,
      sequence: 4,
      simulationTimeMillis: 200,
      tick: 12,
    });
    const gameModelMessage = createGameModelMessage({
      entities: [],
      gameId: "game:test",
      modelVersion: 2,
      sequence: 3,
    });

    expect(isSolitudeServerMessage(gameModelMessage)).toBe(true);
    expect(isSolitudeServerMessage(snapshotMessage)).toBe(true);
    expect(
      isSolitudeServerMessage({
        type: "snapshot",
        entities: null,
        gameId: "game:test",
        modelVersion: 2,
        sequence: 4,
        simulationTimeMillis: 200,
        tick: 12,
      }),
    ).toBe(false);
  });

  it("rejects direct socket run requests", () => {
    expect(
      isSolitudeSocketClientMessage({
        type: "runGame",
        gameId: "game:test",
        requestId: 5,
        dtMillis: 10,
        intervalMillis: 10,
        simulationStepMillis: 1,
      }),
    ).toBe(false);
  });
});
