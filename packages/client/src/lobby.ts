import { createSolitudeWebSocketClient } from "./client";
import {
  createGameHref,
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
const statusEl = queryElement("#status");
const clientId = readClientId("client:a");

let client = createClient();

createGameButton.addEventListener("click", () => {
  void createGame();
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

    const actions = document.createElement("div");
    actions.className = "game-actions";
    actions.append(joinLink);

    item.append(summary, actions);
    gamesListEl.appendChild(item);
  }
}
