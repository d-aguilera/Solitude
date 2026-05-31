import { describe, expect, it } from "vitest";
import {
  createKeyboardInputPatcher,
  createSolitudeWebSocketClient,
  solitudeSpacecraftKeyMap,
  type SolitudeWebSocket,
} from "../client";

describe("Solitude WebSocket browser client", () => {
  it("tracks create/join state and receives pushed snapshots", async () => {
    const socket = createSocketStub();
    const snapshots: unknown[] = [];
    const client = createSolitudeWebSocketClient({
      clientId: "client:a",
      createWebSocket: () => socket,
      url: "ws://server/socket",
    });

    const connectPromise = client.connect({
      onMessage: (message) => snapshots.push(message),
      onReady: () => {},
    });
    socket.open();
    await connectPromise;

    const createPromise = client.createGame();
    await Promise.resolve();
    expect(socket.sentMessages[0]).toEqual({
      message: {
        type: "createGame",
        clientId: "client:a",
        sequence: 1,
      },
      requestId: 1,
      type: "clientMessage",
    });
    socket.receive({
      type: "messages",
      requestId: 1,
      messages: [
        {
          type: "gameCreated",
          clientId: "client:a",
          gameId: "game:1",
          sequence: 1,
        },
      ],
    });

    expect(await createPromise).toHaveLength(1);
    expect(client.state.gameId).toBe("game:1");
    expect(client.state.entityId).toBeNull();

    const joinPromise = client.joinGame("game:1");
    await Promise.resolve();
    socket.receive({
      type: "messages",
      requestId: 2,
      messages: [
        {
          type: "joined",
          clientId: "client:a",
          entityId: "ship:blue",
          gameId: "game:1",
          sequence: 2,
        },
      ],
    });
    await joinPromise;
    expect(client.state.entityId).toBe("ship:blue");

    const runPromise = client.runGame("game:1");
    await Promise.resolve();
    expect(socket.sentMessages[2]).toEqual({
      gameId: "game:1",
      requestId: 3,
      type: "runGame",
    });
    socket.receive({
      type: "messages",
      requestId: 3,
      messages: [],
    });
    await runPromise;

    socket.receive({
      type: "serverMessage",
      message: {
        type: "snapshot",
        gameId: "game:1",
        sequence: 3,
        snapshot: { entities: [] },
        tick: 1,
      },
    });

    expect(snapshots).toEqual([
      {
        type: "snapshot",
        gameId: "game:1",
        sequence: 3,
        snapshot: { entities: [] },
        tick: 1,
      },
    ]);

    const pausePromise = client.pauseGame("game:1");
    await Promise.resolve();
    expect(socket.sentMessages[3]).toEqual({
      gameId: "game:1",
      requestId: 4,
      type: "pauseGame",
    });
    socket.receive({
      type: "messages",
      requestId: 4,
      messages: [],
    });
    await pausePromise;
  });
});

describe("Solitude keyboard input patcher", () => {
  it("sends changed key states as input patches", async () => {
    const patches: unknown[] = [];
    const keyboard = createKeyboardInputPatcher({
      keyMap: solitudeSpacecraftKeyMap,
      sendInputPatch: (controls) => {
        patches.push(controls);
        return [];
      },
    });

    expect(await keyboard.handleKey("Space", true, false)).toBe(true);
    expect(await keyboard.handleKey("Space", true, true)).toBe(false);
    expect(await keyboard.handleKey("Space", false, false)).toBe(true);
    expect(await keyboard.handleKey("Unknown", true, false)).toBe(false);

    expect(patches).toEqual([{ burnForward: true }, { burnForward: false }]);
  });
});

function createSocketStub(): SolitudeWebSocket & {
  open: () => void;
  receive: (payload: unknown) => void;
  sentMessages: unknown[];
} {
  const listeners: Record<
    string,
    Array<(event: Event | MessageEvent) => void>
  > = {};
  const socket = {
    readyState: 0,
    sentMessages: [] as unknown[],
    addEventListener: (
      type: "close" | "error" | "message" | "open",
      listener: (event: Event | MessageEvent) => void,
    ) => {
      listeners[type] ??= [];
      listeners[type].push(listener);
    },
    close: () => {
      socket.readyState = 3;
      emit("close", new Event("close"));
    },
    open: () => {
      socket.readyState = 1;
      emit("open", new Event("open"));
    },
    receive: (payload: unknown) => {
      emit(
        "message",
        new MessageEvent("message", {
          data: JSON.stringify(payload),
        }),
      );
    },
    send: (data: string) => {
      socket.sentMessages.push(JSON.parse(data) as unknown);
    },
  };
  function emit(type: string, event: Event | MessageEvent): void {
    for (const listener of listeners[type] ?? []) {
      listener(event);
    }
  }
  return socket;
}
