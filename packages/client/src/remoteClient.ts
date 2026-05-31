import type { ControlInput } from "@solitude/engine/plugin";
import type {
  SolitudeGameId,
  SolitudeServerMessage,
} from "@solitude/protocol/protocol";
import {
  createKeyboardInputPatcher,
  createSolitudeWebSocketClient,
  solitudeSpacecraftKeyMap,
} from "./client";
import {
  createLobbyHref,
  createSocketUrl,
  queryAnchor,
  queryCanvas,
  queryElement,
  queryInput,
  readClientId,
  readServerBaseUrl,
} from "./pageShared";
import { createSolitudeRemoteClientRenderer } from "./remoteClientRenderer";

const fields = {
  clientId: queryInput("#clientId"),
  entityId: queryInput("#entityId"),
  gameId: queryInput("#gameId"),
};
fields.clientId.value = readClientId(fields.clientId.value);

const gameLabelEl = queryElement("#gameLabel");
const entityLabelEl = queryElement("#entityLabel");
const lobbyLink = queryAnchor("#lobbyLink");
const hudEl = queryElement("#hud");
const snapshotCanvas = queryCanvas("#snapshotCanvas");
const searchParams = new URLSearchParams(window.location.search);
const serverBaseUrl = readServerBaseUrl(searchParams);
const initialGameId = searchParams.get("gameId");

const engineRenderer = createSolitudeRemoteClientRenderer({
  canvas: snapshotCanvas,
  getFocusEntityId: () => fields.entityId.value,
  hudElement: hudEl,
});
lobbyLink.href = createLobbyHref(serverBaseUrl);

let client = createClient();
let activeAutopilotAction: string | null = null;
let lastFrameMillis = performance.now();

const remoteAutopilotKeyMap: Readonly<Record<string, string>> = {
  KeyC: "alignToBody",
  KeyV: "alignToVelocity",
  KeyX: "circleNow",
};

const keyboard = createKeyboardInputPatcher({
  keyMap: solitudeSpacecraftKeyMap,
  sendInputPatch,
});

window.addEventListener(
  "keydown",
  (event) => {
    void handleKeyboardInput(event, true);
  },
  { capture: true },
);

window.addEventListener(
  "keyup",
  (event) => {
    void handleKeyboardInput(event, false);
  },
  { capture: true },
);

if (initialGameId) {
  fields.gameId.value = initialGameId;
  gameLabelEl.textContent = "Game " + initialGameId;
  void joinGame(initialGameId);
} else {
  gameLabelEl.textContent = "No game selected";
}
requestAnimationFrame(renderRemoteFrame);

function createClient() {
  return createSolitudeWebSocketClient({
    clientId: fields.clientId.value,
    createWebSocket: (url) => new WebSocket(url),
    url: createSocketUrl(serverBaseUrl),
  });
}

async function joinGame(gameId: SolitudeGameId): Promise<void> {
  resetClientForCurrentIdentity();
  try {
    handleMessages(await client.joinGame(gameId), true);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Join failed");
  }
}

function resetClientForCurrentIdentity(): void {
  if (client.clientId === fields.clientId.value) return;
  client.close();
  client = createClient();
}

async function handleKeyboardInput(
  event: KeyboardEvent,
  isDown: boolean,
): Promise<void> {
  if (isTextInputTarget(event.target)) return;
  const isSpacecraftKey = Boolean(solitudeSpacecraftKeyMap[event.code]);
  const isAutopilotKey = Boolean(remoteAutopilotKeyMap[event.code]);
  if (!isSpacecraftKey && !isAutopilotKey) return;
  event.preventDefault();
  event.stopPropagation();
  if (!client.state.gameId || !client.state.entityId) {
    return;
  }
  if (isAutopilotKey) {
    if (handleAutopilotKey(event.code, isDown, event.repeat)) return;
  }
  const handled = await keyboard.handleKey(event.code, isDown, event.repeat);
  if (!handled) return;
}

async function sendInputPatch(
  controls: Partial<ControlInput>,
): Promise<SolitudeServerMessage[]> {
  engineRenderer.setControlState(controls);
  const messages = await client.sendInputPatch(controls);
  handleMessages(messages, false);
  return messages;
}

function handleAutopilotKey(
  code: string,
  isDown: boolean,
  repeat: boolean,
): boolean {
  const action = remoteAutopilotKeyMap[code];
  if (!action) return false;
  if (!isDown || repeat) return true;
  activeAutopilotAction = activeAutopilotAction === action ? null : action;
  const controls: Partial<ControlInput> = {
    alignToBody: activeAutopilotAction === "alignToBody",
    alignToVelocity: activeAutopilotAction === "alignToVelocity",
    circleNow: activeAutopilotAction === "circleNow",
  };
  void sendInputPatch(controls);
  return true;
}

function renderRemoteFrame(nowMillis: number): void {
  const dtMillis = Math.max(0, nowMillis - lastFrameMillis);
  lastFrameMillis = nowMillis;
  engineRenderer.renderFrame(nowMillis, dtMillis);
  requestAnimationFrame(renderRemoteFrame);
}

function connectEvents(): void {
  if (!client.state.gameId) {
    return;
  }

  void client.connect({
    onError: () => {
      console.error("WebSocket error");
    },
    onMessage: (message) => {
      handleMessages([message], false);
    },
  });
}

function handleMessages(
  messages: readonly SolitudeServerMessage[],
  connectAfterJoin: boolean,
): void {
  for (const message of messages) {
    switch (message.type) {
      case "gameCreated":
        fields.gameId.value = message.gameId;
        gameLabelEl.textContent = "Game " + message.gameId;
        break;
      case "joined":
        fields.gameId.value = message.gameId;
        fields.entityId.value = message.entityId;
        gameLabelEl.textContent = "Game " + message.gameId;
        entityLabelEl.textContent = "Entity " + message.entityId;
        if (connectAfterJoin) connectEvents();
        break;
      case "gameModel":
        engineRenderer.setModel(message.entities);
        break;
      case "snapshot":
        engineRenderer.pushSnapshotMessage(message);
        break;
      case "error":
        console.error(message.message);
        break;
    }
  }
}

function isTextInputTarget(value: EventTarget | null): boolean {
  return (
    value instanceof HTMLInputElement ||
    value instanceof HTMLTextAreaElement ||
    value instanceof HTMLSelectElement
  );
}
