import type { ControlInput } from "@solitude/engine/plugin";
import {
  createKeyboardInputPatcher,
  createSolitudeWebSocketClient,
  solitudeSpacecraftKeyMap,
} from "@solitude/protocol/client";
import type {
  SolitudeGameId,
  SolitudeServerMessage,
} from "@solitude/protocol/protocol";
import { createSolitudeRemoteClientRenderer } from "../../../solitude/src/remoteClientRenderer";

interface SolitudeGameSummary {
  assignedEntityIds: string[];
  availableEntityIds: string[];
  gameId: SolitudeGameId;
  maxClients: number;
  tick: number;
}

interface SolitudeGameListResponse {
  games?: SolitudeGameSummary[];
}

const fields = {
  clientId: queryInput("#clientId"),
  dtMillis: queryInput("#dtMillis"),
  entityId: queryInput("#entityId"),
  gameId: queryInput("#gameId"),
  runIntervalMillis: queryInput("#runIntervalMillis"),
  simulationStepMillis: queryInput("#simulationStepMillis"),
};
fields.clientId.value = readClientId(fields.clientId.value);

const gamesListEl = queryElement("#gamesList");
const keyStatusEl = queryElement("#keyStatus");
const runStatusEl = queryElement("#runStatus");
const remoteHudEl = queryElement("#remoteHud");
const snapshotCanvas = queryCanvas("#snapshotCanvas");
const snapshotStatusEl = queryElement("#snapshotStatus");
const statusEl = queryElement("#status");
const searchParams = new URLSearchParams(window.location.search);
const initialGameId = searchParams.get("gameId");
const shouldCreateGame = searchParams.get("create") === "1";
const shouldAutostart = searchParams.get("autostart") === "1";

const engineRenderer = createSolitudeRemoteClientRenderer({
  canvas: snapshotCanvas,
  getFocusEntityId: () => fields.entityId.value,
  hudElement: remoteHudEl,
  statusElement: snapshotStatusEl,
});

let client = createClient();
let runActive = false;
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

queryButton("#refreshGames").addEventListener("click", () => {
  void refreshGames();
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

void refreshGames();
if (shouldCreateGame) {
  void createGame({ autostart: shouldAutostart });
} else if (initialGameId) {
  fields.gameId.value = initialGameId;
  void joinGame(initialGameId, { autostart: shouldAutostart });
}
requestAnimationFrame(renderRemoteFrame);

function createClient() {
  return createSolitudeWebSocketClient({
    clientId: fields.clientId.value,
    createWebSocket: (url) => new WebSocket(url),
    url: createSocketUrl(),
  });
}

async function createGame(
  options: { autostart?: boolean } = {},
): Promise<void> {
  resetClientForCurrentIdentity();
  handleMessages(await client.createGame(), { connectAfterJoin: true });
  if (options.autostart) {
    await startServerLoop();
  }
  await refreshGames();
}

async function joinGame(
  gameId: SolitudeGameId,
  options: { autostart?: boolean } = {},
): Promise<void> {
  resetClientForCurrentIdentity();
  handleMessages(await client.joinGame(gameId), { connectAfterJoin: true });
  if (options.autostart) {
    await startServerLoop();
  }
  await refreshGames();
}

function resetClientForCurrentIdentity(): void {
  if (client.clientId === fields.clientId.value) return;
  client.close();
  client = createClient();
}

async function refreshGames(): Promise<void> {
  const response = await fetch("/games");
  const payload = (await response.json()) as SolitudeGameListResponse;
  renderGames(payload.games ?? []);
}

function renderGames(games: readonly SolitudeGameSummary[]): void {
  gamesListEl.textContent = "";
  if (games.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "game-summary";
    emptyItem.textContent = "No games yet";
    gamesListEl.appendChild(emptyItem);
    return;
  }
  for (const game of games) {
    const item = document.createElement("li");
    item.className = "game-row";

    const summary = document.createElement("div");
    summary.className = "game-summary";
    summary.textContent =
      game.gameId +
      " | tick " +
      game.tick +
      " | assigned " +
      formatEntityList(game.assignedEntityIds) +
      " | available " +
      formatEntityList(game.availableEntityIds);

    const joinButton = document.createElement("a");
    joinButton.className = "button secondary";
    joinButton.textContent =
      game.availableEntityIds.length === 0 ? "Full" : "Join";
    if (game.availableEntityIds.length === 0) {
      joinButton.removeAttribute("href");
      joinButton.setAttribute("aria-disabled", "true");
    } else {
      joinButton.href =
        "/remote.html?gameId=" + encodeURIComponent(game.gameId);
    }

    item.append(summary, joinButton);
    gamesListEl.appendChild(item);
  }
}

function formatEntityList(entityIds: readonly string[]): string {
  return entityIds.length === 0 ? "none" : entityIds.join(", ");
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
    keyStatusEl.textContent = "Keyboard controls waiting for assigned entity";
    return;
  }
  if (isAutopilotKey) {
    if (handleAutopilotKey(event.code, isDown, event.repeat)) return;
  }
  const handled = await keyboard.handleKey(event.code, isDown, event.repeat);
  if (!handled) return;
  const action = solitudeSpacecraftKeyMap[event.code];
  keyStatusEl.textContent = action + " " + (isDown ? "held" : "released");
}

async function sendInputPatch(
  controls: Partial<ControlInput>,
): Promise<SolitudeServerMessage[]> {
  engineRenderer.setControlState(controls);
  const messages = await client.sendInputPatch(controls);
  handleMessages(messages);
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
  keyStatusEl.textContent =
    activeAutopilotAction == null
      ? "autopilot released"
      : activeAutopilotAction + " server-authoritative";
  return true;
}

function renderRemoteFrame(nowMillis: number): void {
  const dtMillis = Math.max(0, nowMillis - lastFrameMillis);
  lastFrameMillis = nowMillis;
  engineRenderer.renderFrame(nowMillis, dtMillis);
  requestAnimationFrame(renderRemoteFrame);
}

async function startServerLoop(): Promise<void> {
  if (runActive) return;
  const intervalMillis = readPositiveInteger(fields.runIntervalMillis, 250, 50);
  const dtMillis = readPositiveInteger(fields.dtMillis, 250, 1);
  const simulationStepMillis = readPositiveInteger(
    fields.simulationStepMillis,
    25,
    1,
  );

  handleMessages(
    await client.runGame({
      dtMillis,
      intervalMillis,
      simulationStepMillis,
    }),
  );

  runActive = true;
  runStatusEl.textContent = [
    "Running every",
    intervalMillis,
    "ms at sim",
    dtMillis,
    "ms per interval, fixed step",
    simulationStepMillis,
    "ms",
  ].join(" ");
}

function connectEvents(): void {
  if (!client.state.gameId) {
    statusEl.textContent =
      "Create or join a game before connecting the WebSocket";
    return;
  }

  void client.connect({
    onError: () => {
      statusEl.textContent = "WebSocket error";
    },
    onMessage: (message) => {
      handleMessages([message]);
    },
    onReady: (gameId) => {
      statusEl.textContent = "WebSocket connected for " + gameId;
    },
  });
}

function handleMessages(
  messages: readonly SolitudeServerMessage[],
  options: { connectAfterJoin?: boolean; suppressSnapshots?: boolean } = {},
): void {
  for (const message of messages) {
    switch (message.type) {
      case "gameCreated":
        fields.gameId.value = message.gameId;
        break;
      case "joined":
        fields.gameId.value = message.gameId;
        fields.entityId.value = message.entityId;
        if (options.connectAfterJoin) connectEvents();
        break;
      case "gameModel":
        engineRenderer.setModel(message.entities);
        break;
      case "snapshot":
        engineRenderer.pushSnapshotMessage(message, performance.now());
        if (!options.suppressSnapshots) {
          statusEl.textContent = [
            "tick",
            message.tick,
            "| entities",
            message.snapshot.entities.length,
          ].join(" ");
        }
        break;
      case "error":
        statusEl.textContent = message.message;
        break;
    }
  }
}

function readPositiveInteger(
  input: HTMLInputElement,
  fallback: number,
  minimum: number,
): number {
  const value = Math.max(minimum, Number(input.value) || fallback);
  input.value = String(value);
  return value;
}

function isTextInputTarget(value: EventTarget | null): boolean {
  return (
    value instanceof HTMLInputElement ||
    value instanceof HTMLTextAreaElement ||
    value instanceof HTMLSelectElement
  );
}

function queryButton(selector: string): HTMLButtonElement {
  return queryElementOfType(selector, HTMLButtonElement);
}

function queryCanvas(selector: string): HTMLCanvasElement {
  return queryElementOfType(selector, HTMLCanvasElement);
}

function queryInput(selector: string): HTMLInputElement {
  return queryElementOfType(selector, HTMLInputElement);
}

function queryElement(selector: string): HTMLElement {
  return queryElementOfType(selector, HTMLElement);
}

function queryElementOfType<T extends Element>(
  selector: string,
  constructor: { new (): T },
): T {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor)) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

function createSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/socket`;
}

function readClientId(fallback: string): string {
  const key = "solitude.remoteClientId";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const generated = "client:" + Math.random().toString(36).slice(2, 8);
  window.sessionStorage.setItem(key, generated);
  return fallback === "client:a" ? generated : fallback;
}
