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

export interface SolitudeWebSocketClientOptions {
  clientId: SolitudeClientId;
  createWebSocket: (url: string) => SolitudeWebSocket;
  url: string;
}

export interface SolitudeRemoteClient {
  readonly clientId: SolitudeClientId;
  readonly state: SolitudeClientState;
  close: () => void;
  connect: (handlers: SolitudeSnapshotConnectionHandlers) => Promise<void>;
  createGame: () => Promise<SolitudeServerMessage[]>;
  joinGame: (gameId: SolitudeGameId) => Promise<SolitudeServerMessage[]>;
  leaveGame: () => Promise<SolitudeServerMessage[]>;
  sendInputPatch: (
    controls: Partial<ControlInput>,
  ) => Promise<SolitudeServerMessage[]>;
}

export interface SolitudeClientState {
  entityId: EntityId | null;
  gameId: SolitudeGameId | null;
  nextSequence: SolitudeProtocolSequence;
}

export interface SolitudeSnapshotConnectionHandlers {
  onMessage: (message: SolitudeServerMessage) => void;
  onReady?: (gameId: SolitudeGameId) => void;
  onError?: () => void;
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
    sendInputPatch: (controls) =>
      sendClientMessage({
        type: "input",
        clientId: options.clientId,
        entityId: requireEntityId(),
        gameId: requireGameId(),
        sequence: nextSequence(state),
        controls,
      }),
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

const WebSocketOpen = 1;
