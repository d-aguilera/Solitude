import {
  createKeyboardInputPatcher,
  createSolitudeHttpClient,
  solitudeSpacecraftKeyMap,
  type SolitudeEventSource,
} from "@solitude/protocol/client";
import type {
  SolitudeGameId,
  SolitudeServerMessage,
} from "@solitude/protocol/protocol";
import { createSolitudeRemoteClientRenderer } from "./remoteClientRenderer";

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

const gamesListEl = queryElement("#gamesList");
const keyStatusEl = queryElement("#keyStatus");
const logEl = queryElement("#log");
const runStatusEl = queryElement("#runStatus");
const snapshotCanvas = queryCanvas("#snapshotCanvas");
const snapshotStatusEl = queryElement("#snapshotStatus");
const statusEl = queryElement("#status");
const toggleRunButton = queryButton("#toggleRun");

const engineRenderer = createSolitudeRemoteClientRenderer({
  canvas: snapshotCanvas,
  getFocusEntityId: () => fields.entityId.value,
  statusElement: snapshotStatusEl,
});

let client = createClient();
let events: ReturnType<typeof client.connectSnapshots> = null;
let runActive = false;

const keyboard = createKeyboardInputPatcher({
  keyMap: solitudeSpacecraftKeyMap,
  sendInputPatch: async (controls) => {
    const messages = await client.sendInputPatch(controls);
    handleMessages(messages);
    return messages;
  },
});

queryButton("#createGame").addEventListener("click", () => {
  void createGame();
});

queryButton("#joinGame").addEventListener("click", () => {
  void joinGame(fields.gameId.value);
});

queryButton("#refreshGames").addEventListener("click", () => {
  void refreshGames();
});

queryButton("#connectEvents").addEventListener("click", connectEvents);
toggleRunButton.addEventListener("click", toggleRun);

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

function createClient() {
  return createSolitudeHttpClient({
    baseUrl: "",
    clientId: fields.clientId.value,
    createEventSource,
    fetch: (input, init) => fetch(input, init),
  });
}

async function createGame(): Promise<void> {
  resetClientForCurrentIdentity();
  handleMessages(await client.createGame(), { connectAfterJoin: true });
  await refreshGames();
}

async function joinGame(gameId: SolitudeGameId): Promise<void> {
  resetClientForCurrentIdentity();
  handleMessages(await client.joinGame(gameId), { connectAfterJoin: true });
  await refreshGames();
}

function resetClientForCurrentIdentity(): void {
  if (client.clientId === fields.clientId.value) return;
  events?.close();
  events = null;
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

    const joinButton = document.createElement("button");
    joinButton.className = "secondary";
    joinButton.textContent = "Join";
    joinButton.disabled = game.availableEntityIds.length === 0;
    joinButton.addEventListener("click", () => {
      fields.gameId.value = game.gameId;
      void joinGame(game.gameId);
    });

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
  if (!solitudeSpacecraftKeyMap[event.code]) return;
  event.preventDefault();
  event.stopPropagation();
  if (!client.state.gameId || !client.state.entityId) {
    keyStatusEl.textContent = "Keyboard controls waiting for assigned entity";
    return;
  }
  const handled = await keyboard.handleKey(event.code, isDown, event.repeat);
  if (!handled) return;
  const action = solitudeSpacecraftKeyMap[event.code];
  keyStatusEl.textContent = action + " " + (isDown ? "held" : "released");
}

function toggleRun(): void {
  if (runActive) {
    void pauseServerLoop();
    return;
  }
  if (!client.state.gameId) {
    statusEl.textContent = "Create or join a game before running";
    return;
  }
  void startServerLoop();
}

async function startServerLoop(): Promise<void> {
  const intervalMillis = readPositiveInteger(fields.runIntervalMillis, 250, 50);
  const dtMillis = readPositiveInteger(fields.dtMillis, 250, 1);
  const simulationStepMillis = readPositiveInteger(
    fields.simulationStepMillis,
    25,
    1,
  );

  const response = await fetch("/run", {
    body: JSON.stringify({
      dtMillis,
      gameId: requireGameId(),
      intervalMillis,
      simulationStepMillis,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const payload = await response.json();
  handleMessages(readMessageList(payload));

  runActive = true;
  runStatusEl.textContent = [
    "Server running every",
    intervalMillis,
    "ms at broadcast dt",
    dtMillis,
    "ms, sim step",
    simulationStepMillis,
    "ms",
  ].join(" ");
  toggleRunButton.textContent = "Pause";
}

async function pauseServerLoop(): Promise<void> {
  if (!client.state.gameId) {
    setPausedStatus();
    return;
  }

  const response = await fetch("/pause", {
    body: JSON.stringify({ gameId: client.state.gameId }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const payload = await response.json();
  handleMessages(readMessageList(payload));
  setPausedStatus();
}

function setPausedStatus(): void {
  runActive = false;
  runStatusEl.textContent = "Paused";
  toggleRunButton.textContent = "Run";
}

function connectEvents(): void {
  if (!client.state.gameId) {
    statusEl.textContent =
      "Create or join a game before connecting the snapshot stream";
    return;
  }

  events?.close();
  events = client.connectSnapshots({
    onError: () => {
      statusEl.textContent = "SSE reconnecting";
    },
    onMessage: (message) => {
      handleMessages([message]);
    },
    onReady: (gameId) => {
      statusEl.textContent = "Snapshot stream connected for " + gameId;
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
      case "snapshot":
        engineRenderer.renderSnapshotMessage(message);
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
    log(message);
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

function requireGameId(): SolitudeGameId {
  if (!client.state.gameId) {
    throw new Error("Client is not joined to a game");
  }
  return client.state.gameId;
}

function readMessageList(value: unknown): SolitudeServerMessage[] {
  if (!isRecord(value) || !Array.isArray(value.messages)) {
    throw new Error("Invalid server response");
  }
  return value.messages as SolitudeServerMessage[];
}

function isTextInputTarget(value: EventTarget | null): boolean {
  return (
    value instanceof HTMLInputElement ||
    value instanceof HTMLTextAreaElement ||
    value instanceof HTMLSelectElement
  );
}

let currentLogList: HTMLUListElement | null = null;
let currentLogListMaxDate: Date | null = null;

const summaryFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  month: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  second: "2-digit",
});

function log(value: SolitudeServerMessage): void {
  const loggedValue =
    value.type === "snapshot"
      ? {
          entities: value.snapshot.entities.length,
          gameId: value.gameId,
          sequence: value.sequence,
          tick: value.tick,
          type: value.type,
        }
      : value;

  const newDate = new Date();

  if (!currentLogListMaxDate) {
    currentLogListMaxDate = new Date(
      newDate.getFullYear(),
      newDate.getMonth(),
      newDate.getDate(),
      newDate.getHours(),
      newDate.getMinutes(),
    );
  }

  if (!currentLogList || newDate > currentLogListMaxDate) {
    const summaryEl = document.createElement("summary");
    summaryEl.textContent = summaryFormatter.format(currentLogListMaxDate);
    currentLogList = document.createElement("ul");
    const detailsEl = document.createElement("details");
    detailsEl.append(summaryEl, currentLogList);
    const liEl = document.createElement("li");
    liEl.appendChild(detailsEl);
    logEl.appendChild(liEl);

    currentLogListMaxDate.setMinutes(currentLogListMaxDate.getMinutes() + 1);
  }

  const timeEl = document.createElement("span");
  timeEl.textContent = formatLogTime(newDate);
  const textEl = document.createElement("pre");
  textEl.textContent = JSON.stringify(loggedValue, null, 2);
  const subliEl = document.createElement("li");
  subliEl.append(timeEl, textEl);

  currentLogList.appendChild(subliEl);
}

function queryButton(selector: string): HTMLButtonElement {
  return queryElementOfType(selector, HTMLButtonElement);
}

function createEventSource(url: string): SolitudeEventSource {
  const events = new EventSource(url);
  const wrapper: SolitudeEventSource = {
    addEventListener: (type, listener) => {
      events.addEventListener(type, (event) => {
        listener(event as MessageEvent);
      });
    },
    close: () => {
      events.close();
    },
    onerror: null,
    onmessage: null,
  };
  events.onerror = () => {
    wrapper.onerror?.();
  };
  events.onmessage = (event) => {
    wrapper.onmessage?.(event);
  };
  return wrapper;
}

function formatLogTime(date: Date): string {
  return (
    timeFormatter.format(date) +
    "." +
    String(date.getMilliseconds()).padStart(3, "0")
  );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
