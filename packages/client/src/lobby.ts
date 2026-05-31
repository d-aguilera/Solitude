import type { SolitudeGameId } from "@solitude/protocol/protocol";
import { createSolitudeWebSocketClient } from "./client";
import {
  DEFAULT_RUN_PARAMS,
  createGameHref,
  createHttpUrl,
  createSocketUrl,
  fetchGameList,
  formatEntityList,
  queryButton,
  queryElement,
  readClientId,
  readServerBaseUrl,
  type SolitudeGameSummary,
} from "./pageShared";

const REFRESH_INTERVAL_MILLIS = 3000;

const searchParams = new URLSearchParams(window.location.search);
const serverBaseUrl = readServerBaseUrl(searchParams);
const createGameButton = queryButton("#createGame");
const gamesListEl = queryElement("#gamesList");
const refreshGamesButton = queryButton("#refreshGames");
const statusEl = queryElement("#status");
const clientId = readClientId("client:a");

let client = createClient();

createGameButton.addEventListener("click", () => {
  void createGame();
});

refreshGamesButton.addEventListener("click", () => {
  void refreshGames();
});

void refreshGames();
window.setInterval(() => {
  void refreshGames();
}, REFRESH_INTERVAL_MILLIS);

function createClient() {
  return createSolitudeWebSocketClient({
    clientId,
    createWebSocket: (url) => new WebSocket(url),
    url: createSocketUrl(serverBaseUrl),
  });
}

async function createGame(): Promise<void> {
  createGameButton.disabled = true;
  statusEl.textContent = "Creating game";
  try {
    client.close();
    client = createClient();
    await client.createGame();
    if (!client.state.gameId) {
      throw new Error("Game creation did not assign a game id");
    }
    await client.runGame(client.state.gameId, DEFAULT_RUN_PARAMS);
    await refreshGames();
    statusEl.textContent = "Game created";
  } catch (error) {
    statusEl.textContent =
      error instanceof Error ? error.message : "Create failed";
  } finally {
    createGameButton.disabled = false;
  }
}

async function refreshGames(): Promise<void> {
  try {
    const payload = await fetchGameList(serverBaseUrl);
    renderGames(payload.games);
    if (statusEl.textContent === "Refreshing games") {
      statusEl.textContent = "Ready";
    }
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
      joinLink.href = createGameHref(serverBaseUrl, { gameId: game.gameId });
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
  await client.pauseGame(gameId);
  await refreshGames();
}

async function deleteGame(gameId: SolitudeGameId): Promise<void> {
  statusEl.textContent = "Deleting " + gameId;
  const response = await fetch(
    createHttpUrl(serverBaseUrl, "/games/" + encodeURIComponent(gameId)),
    { method: "DELETE" },
  );
  if (!response.ok) {
    const payload = (await response.json()) as {
      messages: Array<{ message: string }>;
    };
    statusEl.textContent =
      payload.messages.length > 0
        ? payload.messages[0].message
        : "Delete failed: " + gameId;
    return;
  }
  await refreshGames();
}
