import type { ControlInput } from "@solitude/engine/plugin";
import type { EntityId } from "@solitude/engine/world";
import {
  type JoinedGameMessage,
  type SolitudeClientId,
  type SolitudeClientMessage,
  type SolitudeGameId,
  type SolitudeProtocolSequence,
  type SolitudeServerMessage,
} from "./protocol";

export interface SolitudeHttpClientOptions {
  baseUrl: string;
  clientId: SolitudeClientId;
  createEventSource: (url: string) => SolitudeEventSource;
  fetch: SolitudeFetch;
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
