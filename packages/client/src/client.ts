import type { ControlInput } from "@solitude/engine/plugin";
import type { EntityId } from "@solitude/engine/world";
import {
  type JoinedGameMessage,
  type SolitudeClientId,
  type SolitudeClientMessage,
  type SolitudeGameId,
  type SolitudeProtocolSequence,
  type SolitudeServerMessage,
  type SolitudeSocketClientMessage,
  isSolitudeSocketServerMessage,
} from "@solitude/protocol/protocol";

export interface SolitudeHttpClientOptions {
  baseUrl: string;
  clientId: SolitudeClientId;
  createEventSource: (url: string) => SolitudeEventSource;
  fetch: SolitudeFetch;
}

export interface SolitudeWebSocketClientOptions {
  clientId: SolitudeClientId;
  createWebSocket: (url: string) => SolitudeWebSocket;
  url: string;
}

export interface SolitudeHttpClient {
  readonly clientId: SolitudeClientId;
  readonly state: SolitudeClientState;
  connectSnapshots: (
    handlers: SolitudeSnapshotConnectionHandlers,
  ) => SolitudeSnapshotConnection | null;
  createGame: () => Promise<SolitudeServerMessage[]>;
  joinGame: (gameId: SolitudeGameId) => Promise<SolitudeServerMessage[]>;
  leaveGame: () => Promise<SolitudeServerMessage[]>;
  sendInputPatch: (
    controls: Partial<ControlInput>,
  ) => Promise<SolitudeServerMessage[]>;
  stepGame: (dtMillis: number) => Promise<SolitudeServerMessage[]>;
}

export interface SolitudeRemoteClient {
  readonly clientId: SolitudeClientId;
  readonly state: SolitudeClientState;
  close: () => void;
  connect: (handlers: SolitudeSnapshotConnectionHandlers) => Promise<void>;
  createGame: () => Promise<SolitudeServerMessage[]>;
  joinGame: (gameId: SolitudeGameId) => Promise<SolitudeServerMessage[]>;
  leaveGame: () => Promise<SolitudeServerMessage[]>;
  pauseGame: () => Promise<SolitudeServerMessage[]>;
  runGame: (params: SolitudeRunGameParams) => Promise<SolitudeServerMessage[]>;
  sendInputPatch: (
    controls: Partial<ControlInput>,
  ) => Promise<SolitudeServerMessage[]>;
  stepGame: (dtMillis: number) => Promise<SolitudeServerMessage[]>;
}

export interface SolitudeClientState {
  entityId: EntityId | null;
  gameId: SolitudeGameId | null;
  nextSequence: SolitudeProtocolSequence;
}

export interface SolitudeSnapshotConnection {
  close: () => void;
}

export interface SolitudeSnapshotConnectionHandlers {
  onMessage: (message: SolitudeServerMessage) => void;
  onReady?: (gameId: SolitudeGameId) => void;
  onError?: () => void;
}

export interface SolitudeEventSource {
  addEventListener: (
    type: "ready",
    listener: (event: MessageEvent) => void,
  ) => void;
  close: () => void;
  onerror: (() => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
}

export interface SolitudeWebSocket {
  addEventListener: (
    type: "close" | "error" | "message" | "open",
    listener: (event: Event | MessageEvent) => void,
  ) => void;
  close: () => void;
  readyState: number;
  send: (data: string) => void;
}

export interface SolitudeRunGameParams {
  dtMillis: number;
  intervalMillis: number;
  simulationStepMillis: number;
}

export type SolitudeFetch = (
  input: string,
  init?: {
    body?: string;
    headers?: Record<string, string>;
    method?: string;
  },
) => Promise<{ json: () => Promise<unknown> }>;

export interface KeyboardInputPatcherOptions {
  keyMap: Readonly<Record<string, string>>;
  sendInputPatch: (
    controls: Partial<ControlInput>,
  ) => Promise<SolitudeServerMessage[]> | SolitudeServerMessage[];
}

export interface KeyboardInputPatcher {
  readonly heldControls: Readonly<Partial<ControlInput>>;
  handleKey: (
    code: string,
    isDown: boolean,
    repeat: boolean,
  ) => Promise<boolean>;
}

export const solitudeSpacecraftKeyMap: Readonly<Record<string, string>> = {
  Digit0: "thrust0",
  Digit1: "thrust1",
  Digit2: "thrust2",
  Digit3: "thrust3",
  Digit4: "thrust4",
  Digit5: "thrust5",
  Digit6: "thrust6",
  Digit7: "thrust7",
  Digit8: "thrust8",
  Digit9: "thrust9",
  KeyA: "yawLeft",
  KeyB: "burnBackwards",
  KeyD: "yawRight",
  KeyE: "rollRight",
  KeyM: "burnRight",
  KeyN: "burnLeft",
  KeyQ: "rollLeft",
  KeyS: "pitchDown",
  KeyW: "pitchUp",
  Space: "burnForward",
};

export function createSolitudeHttpClient(
  options: SolitudeHttpClientOptions,
): SolitudeHttpClient {
  const state: SolitudeClientState = {
    entityId: null,
    gameId: null,
    nextSequence: 1,
  };

  const receiveMessages = (
    messages: readonly SolitudeServerMessage[],
  ): SolitudeServerMessage[] => {
    for (const message of messages) {
      if (message.type === "gameCreated") {
        state.gameId = message.gameId;
      } else if (message.type === "joined") {
        applyJoinMessage(state, message);
      }
    }
    return [...messages];
  };

  const sendMessage = async (
    message: SolitudeClientMessage,
  ): Promise<SolitudeServerMessage[]> => {
    const response = await options.fetch(`${options.baseUrl}/message`, {
      body: JSON.stringify(message),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const payload = await response.json();
    return receiveMessages(readMessages(payload));
  };

  const requireGameId = (): SolitudeGameId => {
    if (!state.gameId) {
      throw new Error("Client is not joined to a game");
    }
    return state.gameId;
  };

  const requireEntityId = (): EntityId => {
    if (!state.entityId) {
      throw new Error("Client is not assigned to an entity");
    }
    return state.entityId;
  };

  return {
    clientId: options.clientId,
    state,
    connectSnapshots: (handlers) => {
      if (!state.gameId) return null;
      const events = options.createEventSource(
        `${options.baseUrl}/events?gameId=${encodeURIComponent(state.gameId)}`,
      );
      events.addEventListener("ready", (event) => {
        handlers.onReady?.(readReadyGameId(event.data));
      });
      events.onmessage = (event) => {
        handlers.onMessage(JSON.parse(event.data) as SolitudeServerMessage);
      };
      events.onerror = () => {
        handlers.onError?.();
      };
      return { close: () => events.close() };
    },
    createGame: () =>
      sendMessage({
        type: "createGame",
        clientId: options.clientId,
        sequence: nextSequence(state),
      }),
    joinGame: (gameId) =>
      sendMessage({
        type: "joinGame",
        clientId: options.clientId,
        gameId,
        sequence: nextSequence(state),
      }),
    leaveGame: async () => {
      const gameId = requireGameId();
      const messages = await sendMessage({
        type: "leaveGame",
        clientId: options.clientId,
        gameId,
        sequence: nextSequence(state),
      });
      state.entityId = null;
      state.gameId = null;
      return messages;
    },
    sendInputPatch: (controls) =>
      sendMessage({
        type: "input",
        clientId: options.clientId,
        entityId: requireEntityId(),
        gameId: requireGameId(),
        sequence: nextSequence(state),
        controls,
      }),
    stepGame: async (dtMillis) => {
      const response = await options.fetch(`${options.baseUrl}/step`, {
        body: JSON.stringify({
          dtMillis,
          gameId: requireGameId(),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();
      return readMessages(payload);
    },
  };
}

export function createSolitudeWebSocketClient(
  options: SolitudeWebSocketClientOptions,
): SolitudeRemoteClient {
  const defaultHandlers: SolitudeSnapshotConnectionHandlers = {
    onMessage: () => {},
  };
  const state: SolitudeClientState = {
    entityId: null,
    gameId: null,
    nextSequence: 1,
  };
  let socket: SolitudeWebSocket | null = null;
  let connectPromise: Promise<void> | null = null;
  let handlers: SolitudeSnapshotConnectionHandlers | null = null;
  const pendingRequests = new Map<
    SolitudeProtocolSequence,
    {
      reject: (error: Error) => void;
      resolve: (messages: SolitudeServerMessage[]) => void;
    }
  >();

  const receiveMessages = (
    messages: readonly SolitudeServerMessage[],
  ): SolitudeServerMessage[] => {
    for (const message of messages) {
      receiveMessage(message);
    }
    return [...messages];
  };

  const receiveMessage = (message: SolitudeServerMessage): void => {
    if (message.type === "gameCreated") {
      state.gameId = message.gameId;
    } else if (message.type === "joined") {
      applyJoinMessage(state, message);
    }
  };

  const connect = (
    nextHandlers: SolitudeSnapshotConnectionHandlers,
  ): Promise<void> => {
    handlers = nextHandlers;
    if (socket && socket.readyState === WebSocketOpen) {
      if (state.gameId) handlers.onReady?.(state.gameId);
      return Promise.resolve();
    }
    if (connectPromise) return connectPromise;

    socket = options.createWebSocket(options.url);
    connectPromise = new Promise<void>((resolve, reject) => {
      const rejectPending = (error: Error) => {
        for (const pending of pendingRequests.values()) {
          pending.reject(error);
        }
        pendingRequests.clear();
      };
      socket?.addEventListener("open", () => {
        resolve();
      });
      socket?.addEventListener("message", (event) => {
        if (!("data" in event)) return;
        handleSocketMessage(event.data);
      });
      socket?.addEventListener("error", () => {
        handlers?.onError?.();
      });
      socket?.addEventListener("close", () => {
        connectPromise = null;
        rejectPending(new Error("Solitude WebSocket closed"));
      });
      socket?.addEventListener("error", () => {
        if (socket?.readyState !== WebSocketOpen) {
          reject(new Error("Failed to connect Solitude WebSocket"));
        }
      });
    });
    return connectPromise;
  };

  const sendSocketRequest = async (
    request: SolitudeSocketClientMessage,
  ): Promise<SolitudeServerMessage[]> => {
    if (!handlers) {
      handlers = defaultHandlers;
    }
    await connect(handlers ?? defaultHandlers);
    const activeSocket = socket;
    if (!activeSocket || activeSocket.readyState !== WebSocketOpen) {
      throw new Error("Solitude WebSocket is not open");
    }
    const messages = await new Promise<SolitudeServerMessage[]>(
      (resolve, reject) => {
        pendingRequests.set(request.requestId, { reject, resolve });
        activeSocket.send(JSON.stringify(request));
      },
    );
    return receiveMessages(messages);
  };

  const sendClientMessage = (
    message: SolitudeClientMessage,
  ): Promise<SolitudeServerMessage[]> =>
    sendSocketRequest({
      message,
      requestId: message.sequence,
      type: "clientMessage",
    });

  const handleSocketMessage = (data: unknown): void => {
    const payload = JSON.parse(String(data)) as unknown;
    if (!isSolitudeSocketServerMessage(payload)) {
      handlers?.onError?.();
      return;
    }
    switch (payload.type) {
      case "ready":
        if (state.gameId) handlers?.onReady?.(state.gameId);
        break;
      case "messages": {
        const pending = pendingRequests.get(payload.requestId);
        if (!pending) return;
        pendingRequests.delete(payload.requestId);
        pending.resolve(payload.messages);
        break;
      }
      case "serverMessage":
        receiveMessage(payload.message);
        handlers?.onMessage(payload.message);
        break;
    }
  };

  const requireGameId = (): SolitudeGameId => {
    if (!state.gameId) {
      throw new Error("Client is not joined to a game");
    }
    return state.gameId;
  };

  const requireEntityId = (): EntityId => {
    if (!state.entityId) {
      throw new Error("Client is not assigned to an entity");
    }
    return state.entityId;
  };

  return {
    clientId: options.clientId,
    state,
    close: () => {
      socket?.close();
      socket = null;
      connectPromise = null;
    },
    connect,
    createGame: () =>
      sendClientMessage({
        type: "createGame",
        clientId: options.clientId,
        sequence: nextSequence(state),
      }),
    joinGame: (gameId) =>
      sendClientMessage({
        type: "joinGame",
        clientId: options.clientId,
        gameId,
        sequence: nextSequence(state),
      }),
    leaveGame: async () => {
      const gameId = requireGameId();
      const messages = await sendClientMessage({
        type: "leaveGame",
        clientId: options.clientId,
        gameId,
        sequence: nextSequence(state),
      });
      state.entityId = null;
      state.gameId = null;
      return messages;
    },
    pauseGame: () =>
      sendSocketRequest({
        gameId: requireGameId(),
        requestId: nextSequence(state),
        type: "pauseGame",
      }),
    runGame: (params) =>
      sendSocketRequest({
        ...params,
        gameId: requireGameId(),
        requestId: nextSequence(state),
        type: "runGame",
      }),
    sendInputPatch: (controls) =>
      sendClientMessage({
        type: "input",
        clientId: options.clientId,
        entityId: requireEntityId(),
        gameId: requireGameId(),
        sequence: nextSequence(state),
        controls,
      }),
    stepGame: async () => {
      throw new Error("Manual step is HTTP-only");
    },
  };
}

export function createKeyboardInputPatcher(
  options: KeyboardInputPatcherOptions,
): KeyboardInputPatcher {
  const heldControls: Partial<ControlInput> = {};
  return {
    heldControls,
    handleKey: async (code, isDown, repeat) => {
      if (repeat) return false;
      const action = options.keyMap[code];
      if (!action) return false;
      if (heldControls[action] === isDown) return true;
      heldControls[action] = isDown;
      await options.sendInputPatch({ [action]: isDown });
      return true;
    },
  };
}

function applyJoinMessage(
  state: SolitudeClientState,
  message: JoinedGameMessage,
): void {
  state.entityId = message.entityId;
  state.gameId = message.gameId;
}

function nextSequence(state: SolitudeClientState): SolitudeProtocolSequence {
  const sequence = state.nextSequence;
  state.nextSequence++;
  return sequence;
}

function readMessages(payload: unknown): SolitudeServerMessage[] {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) {
    throw new Error("Invalid server response");
  }
  return payload.messages as SolitudeServerMessage[];
}

function readReadyGameId(data: string): SolitudeGameId {
  const payload = JSON.parse(data) as unknown;
  if (!isRecord(payload) || typeof payload.gameId !== "string") {
    throw new Error("Invalid ready event");
  }
  return payload.gameId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const WebSocketOpen = 1;
