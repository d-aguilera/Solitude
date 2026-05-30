import type { SolitudeGameId } from "@solitude/protocol/protocol";

interface SolitudeGameSummary {
  assignedEntityIds: string[];
  availableEntityIds: string[];
  gameId: SolitudeGameId;
  maxClients: number;
  running?: boolean;
  tick: number;
}

interface SolitudeGameListResponse {
  games?: SolitudeGameSummary[];
}

const CLIENT_ID_STORAGE_KEY = "solitude.clientId";

const searchParams = new URLSearchParams(window.location.search);
const serverBaseUrl = readServerBaseUrl(searchParams);
const createGameButton = queryButton("#createGame");
const gamesListEl = queryElement("#gamesList");
const refreshGamesButton = queryButton("#refreshGames");
const statusEl = queryElement("#status");

createGameButton.addEventListener("click", () => {
  createGame();
});

refreshGamesButton.addEventListener("click", () => {
  void refreshGames();
});

void refreshGames();

function createGame(): void {
  createGameButton.disabled = true;
  statusEl.textContent = "Opening game";
  readClientId();
  window.location.href = createGameHref({ autostart: "1", create: "1" });
}

async function refreshGames(): Promise<void> {
  try {
    const response = await fetch(createHttpUrl("/games"));
    const payload = (await response.json()) as SolitudeGameListResponse;
    renderGames(payload.games ?? []);
    statusEl.textContent = "Ready";
  } catch (error) {
    statusEl.textContent =
      error instanceof Error ? error.message : "Refresh failed";
  }
}

function renderGames(games: readonly SolitudeGameSummary[]): void {
  gamesListEl.textContent = "";
  if (games.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "game-summary empty";
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
      " | " +
      (game.running ? "running" : "stopped") +
      " | tick " +
      game.tick +
      " | assigned " +
      formatEntityList(game.assignedEntityIds) +
      " | available " +
      formatEntityList(game.availableEntityIds);

    const joinLink = document.createElement("a");
    joinLink.className = "button secondary";
    joinLink.textContent =
      game.availableEntityIds.length === 0 ? "Full" : "Join";
    if (game.availableEntityIds.length === 0) {
      joinLink.removeAttribute("href");
      joinLink.setAttribute("aria-disabled", "true");
    } else {
      joinLink.href = createGameHref({ gameId: game.gameId });
    }

    const stopButton = document.createElement("button");
    stopButton.className = "secondary";
    stopButton.textContent = "Stop";
    stopButton.disabled = !game.running;
    stopButton.addEventListener("click", () => {
      void stopGame(game.gameId);
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "danger";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      void deleteGame(game.gameId);
    });

    const actions = document.createElement("div");
    actions.className = "game-actions";
    actions.append(joinLink, stopButton, deleteButton);

    item.append(summary, actions);
    gamesListEl.appendChild(item);
  }
}

async function stopGame(gameId: SolitudeGameId): Promise<void> {
  statusEl.textContent = "Stopping " + gameId;
  await postJson("/pause", { gameId });
  await refreshGames();
}

async function deleteGame(gameId: SolitudeGameId): Promise<void> {
  statusEl.textContent = "Deleting " + gameId;
  const response = await fetch(
    createHttpUrl("/games/" + encodeURIComponent(gameId)),
    { method: "DELETE" },
  );
  if (!response.ok) {
    const payload = (await response.json()) as {
      messages?: Array<{ message?: string }>;
    };
    statusEl.textContent =
      payload.messages?.[0]?.message ?? "Delete failed: " + gameId;
    return;
  }
  await refreshGames();
}

async function postJson(pathname: string, body: unknown): Promise<unknown> {
  const response = await fetch(createHttpUrl(pathname), {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return response.json();
}

function formatEntityList(entityIds: readonly string[]): string {
  return entityIds.length === 0 ? "none" : entityIds.join(", ");
}

function readClientId(): string {
  const existing = window.sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated = "client:" + Math.random().toString(36).slice(2, 8);
  window.sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
  return generated;
}

function createHttpUrl(pathname: string): string {
  const url = new URL(serverBaseUrl.href);
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return url.href;
}

function createGameHref(params: Record<string, string>): string {
  const url = new URL("/game.html", window.location.href);
  if (shouldPersistServerUrl()) {
    url.searchParams.set("server", serverBaseUrl.href);
  }
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

function readServerBaseUrl(searchParams: URLSearchParams): URL {
  const fromQuery = searchParams.get("server");
  const fromBuild = import.meta.env.VITE_SOLITUDE_SERVER_URL;
  return new URL(fromQuery || fromBuild || window.location.origin);
}

function shouldPersistServerUrl(): boolean {
  return serverBaseUrl.origin !== window.location.origin;
}

function queryButton(selector: string): HTMLButtonElement {
  return queryElementOfType(selector, HTMLButtonElement);
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
