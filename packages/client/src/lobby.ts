import { parseRuntimeOptionsFromSearch } from "@solitude/browser/dom/runtimeOptions";
import {
  createRuntimeOptionsWithResolvedLocale,
  resolveSolitudeLocale,
  type SolitudeLocale,
} from "@solitude/sim/localization";
import { createSolitudeWebSocketClient } from "./client";
import { createClientLocalization } from "./localization";
import {
  createGameHref,
  createSocketUrl,
  fetchGameList,
  queryButton,
  queryElement,
  querySelect,
  readClientId,
  readServerBaseUrl,
  type SolitudeGameSummary,
} from "./pageShared";

const REFRESH_INTERVAL_MILLIS = 3000;

const searchParams = new URLSearchParams(window.location.search);
const serverBaseUrl = readServerBaseUrl(searchParams);
const createGameButton = queryButton("#createGame");
const gamesListEl = queryElement("#gamesList");
const gamesHeadingEl = queryElement("#gamesHeading");
const languageLabelEl = queryElement("#languageLabel");
const localeSelect = querySelect("#localeSelect");
const statusEl = queryElement("#status");
const clientId = readClientId("client:a");
const runtimeOptions = createRuntimeOptionsWithResolvedLocale(
  parseRuntimeOptionsFromSearch(window.location.search),
  navigator.languages,
);
let localization = createClientLocalization(
  resolveSolitudeLocale(runtimeOptions),
);

let client = createClient();

initializeLocaleSelect();
applyLocalizedShellText();
createGameButton.addEventListener("click", () => {
  void createGame();
});
localeSelect.addEventListener("change", () => {
  localization = createClientLocalization(readSelectedLocale());
  persistSelectedLocale();
  applyLocalizedShellText();
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
  statusEl.textContent = localization.lobby.creatingGame;
  try {
    client.close();
    client = createClient();
    await client.createGame();
    if (!client.state.gameId) {
      throw new Error("Game creation did not assign a game id");
    }
    await refreshGames();
    statusEl.textContent = localization.lobby.gameCreated;
  } catch (error) {
    statusEl.textContent =
      error instanceof Error ? error.message : localization.lobby.createFailed;
  } finally {
    createGameButton.disabled = false;
  }
}

async function refreshGames(): Promise<void> {
  try {
    const payload = await fetchGameList(serverBaseUrl);
    renderGames(payload.games);
    if (statusEl.textContent === localization.lobby.refreshingGames) {
      statusEl.textContent = localization.lobby.ready;
    }
  } catch (error) {
    statusEl.textContent =
      error instanceof Error ? error.message : localization.lobby.refreshFailed;
  }
}

function renderGames(games: readonly SolitudeGameSummary[]): void {
  gamesListEl.textContent = "";
  if (games.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "game-summary empty";
    emptyItem.textContent = localization.lobby.noGamesYet;
    gamesListEl.appendChild(emptyItem);
    return;
  }
  for (const game of games) {
    const item = document.createElement("li");
    item.className = "game-row";

    const summary = document.createElement("div");
    summary.className = "game-summary";
    summary.textContent = localization.lobby.gameSummary(game);

    const joinLink = document.createElement("a");
    joinLink.className = "button secondary";
    joinLink.textContent =
      game.availableEntityIds.length === 0
        ? localization.lobby.full
        : localization.lobby.join;
    if (game.availableEntityIds.length === 0) {
      joinLink.removeAttribute("href");
      joinLink.setAttribute("aria-disabled", "true");
    } else {
      joinLink.href = createGameHref(serverBaseUrl, {
        gameId: game.gameId,
        locale: readSelectedLocale(),
      });
    }

    const actions = document.createElement("div");
    actions.className = "game-actions";
    actions.append(joinLink);

    item.append(summary, actions);
    gamesListEl.appendChild(item);
  }
}

function initializeLocaleSelect(): void {
  localeSelect.textContent = "";
  for (const option of localization.localeOptions) {
    const element = document.createElement("option");
    element.value = option.locale;
    element.textContent = option.label;
    localeSelect.appendChild(element);
  }
  localeSelect.value = localization.locale;
  persistSelectedLocale();
}

function applyLocalizedShellText(): void {
  document.documentElement.lang = localization.htmlLang;
  createGameButton.textContent = localization.lobby.createGame;
  gamesHeadingEl.textContent = localization.lobby.gamesHeading;
  languageLabelEl.textContent = localization.lobby.languageLabel;
  if (
    statusEl.textContent === "" ||
    statusEl.textContent === "Ready" ||
    statusEl.textContent === "Prêt"
  ) {
    statusEl.textContent = localization.lobby.ready;
  }
}

function readSelectedLocale(): SolitudeLocale {
  return resolveSolitudeLocale({ locale: localeSelect.value });
}

function persistSelectedLocale(): void {
  const url = new URL(window.location.href);
  url.searchParams.set("locale", readSelectedLocale());
  window.history.replaceState(null, "", url);
}
