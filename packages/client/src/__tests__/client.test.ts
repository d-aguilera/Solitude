import { describe, expect, it } from "vitest";
import {
  createKeyboardInputPatcher,
  createSolitudeHttpClient,
  createSolitudeWebSocketClient,
  solitudeSpacecraftKeyMap,
  type SolitudeEventSource,
  type SolitudeFetch,
  type SolitudeWebSocket,
} from "../client";

describe("Solitude HTTP browser client", () => {
  it("tracks create/join state and sends sequenced input patches", async () => {
    const requests: Array<{ body: unknown; url: string }> = [];
    const client = createSolitudeHttpClient({
      baseUrl: "",
      clientId: "client:a",
      createEventSource: createNoopEventSource,
      fetch: createFetchStub(requests),
    });

    expect(await client.createGame()).toEqual([
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
    await client.sendInputPatch({ burnForward: true });

    expect(client.state.gameId).toBe("game:1");
    expect(client.state.entityId).toBe("ship:blue");
    expect(requests[requests.length - 1]?.body).toEqual({
      type: "input",
      clientId: "client:a",
      entityId: "ship:blue",
      gameId: "game:1",
      sequence: 2,
      controls: { burnForward: true },
    });
  });

  it("connects snapshots only after joining a game", async () => {
    const eventSources: string[] = [];
    const client = createSolitudeHttpClient({
      baseUrl: "http://server",
      clientId: "client:a",
      createEventSource: (url) => {
        eventSources.push(url);
        return createNoopEventSource();
      },
      fetch: createFetchStub([]),
    });

    expect(client.connectSnapshots({ onMessage: () => {} })).toBeNull();
    await client.joinGame("game:2");
    client.connectSnapshots({ onMessage: () => {} });

    expect(eventSources).toEqual(["http://server/events?gameId=game%3A2"]);
  });
});

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
        {
          type: "joined",
          clientId: "client:a",
          entityId: "ship:blue",
          gameId: "game:1",
          sequence: 2,
        },
      ],
    });

    expect(await createPromise).toHaveLength(2);
    expect(client.state.gameId).toBe("game:1");
    expect(client.state.entityId).toBe("ship:blue");

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

function createFetchStub(
  requests: Array<{ body: unknown; url: string }>,
): SolitudeFetch {
  return async (url, init) => {
    const body = init?.body ? (JSON.parse(init.body) as unknown) : {};
    requests.push({ body, url });
    if (isRecord(body) && body.type === "createGame") {
      return {
        json: async () => ({
          messages: [
            {
              type: "gameCreated",
              clientId: body.clientId,
              gameId: "game:1",
              sequence: body.sequence,
            },
            {
              type: "joined",
              clientId: body.clientId,
              entityId: "ship:blue",
              gameId: "game:1",
              sequence: Number(body.sequence) + 1,
            },
          ],
        }),
      };
    }
    if (isRecord(body) && body.type === "joinGame") {
      return {
        json: async () => ({
          messages: [
            {
              type: "joined",
              clientId: body.clientId,
              entityId: "ship:blue",
              gameId: body.gameId,
              sequence: body.sequence,
            },
          ],
        }),
      };
    }
    return { json: async () => ({ messages: [] }) };
  };
}

function createNoopEventSource(): SolitudeEventSource {
  return {
    addEventListener: () => {},
    close: () => {},
    onerror: null,
    onmessage: null,
  };
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
