import type { SolitudeGameId } from "@solitude/protocol/protocol";
import type { SolitudeRunGameParams } from "./client";

export interface SolitudeGameSummary {
  assignedEntityIds: string[];
  availableEntityIds: string[];
  gameId: SolitudeGameId;
  maxClients: number;
  running: boolean;
  tick: number;
}

export interface SolitudeGameListResponse {
  games: SolitudeGameSummary[];
}

export const DEFAULT_RUN_PARAMS: SolitudeRunGameParams = {
  dtMillis: 250,
  intervalMillis: 250,
  simulationStepMillis: 25,
};

const CLIENT_ID_STORAGE_KEY = "solitude.clientId";

export function createGameHref(
  serverBaseUrl: URL,
  params: Record<string, string>,
): string {
  const url = new URL("/game.html", window.location.href);
  persistServerUrl(url, serverBaseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

export function createLobbyHref(serverBaseUrl: URL): string {
  const url = new URL("/", window.location.href);
  persistServerUrl(url, serverBaseUrl);
  return url.href;
}

export function createHttpUrl(serverBaseUrl: URL, pathname: string): string {
  const url = new URL(serverBaseUrl.href);
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return url.href;
}

export function createSocketUrl(serverBaseUrl: URL): string {
  const socketUrl = new URL(serverBaseUrl.href);
  socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
  socketUrl.pathname = "/socket";
  socketUrl.search = "";
  socketUrl.hash = "";
  return socketUrl.href;
}

export function readServerBaseUrl(searchParams: URLSearchParams): URL {
  const fromQuery = searchParams.get("server");
  const fromBuild = import.meta.env.VITE_SOLITUDE_SERVER_URL;
  return new URL(fromQuery || fromBuild || window.location.origin);
}

export function readClientId(fallback: string): string {
  const existing = window.sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated = "client:" + Math.random().toString(36).slice(2, 8);
  window.sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
  return fallback === "client:a" ? generated : fallback;
}

export async function fetchGameList(
  serverBaseUrl: URL,
): Promise<SolitudeGameListResponse> {
  const response = await fetch(createHttpUrl(serverBaseUrl, "/games"));
  return (await response.json()) as SolitudeGameListResponse;
}

export async function postJson(
  serverBaseUrl: URL,
  pathname: string,
  body: unknown,
): Promise<unknown> {
  const response = await fetch(createHttpUrl(serverBaseUrl, pathname), {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return response.json();
}

export function formatEntityList(entityIds: readonly string[]): string {
  return entityIds.length === 0 ? "none" : entityIds.join(", ");
}

export function queryAnchor(selector: string): HTMLAnchorElement {
  return queryElementOfType(selector, HTMLAnchorElement);
}

export function queryButton(selector: string): HTMLButtonElement {
  return queryElementOfType(selector, HTMLButtonElement);
}

export function queryCanvas(selector: string): HTMLCanvasElement {
  return queryElementOfType(selector, HTMLCanvasElement);
}

export function queryElement(selector: string): HTMLElement {
  return queryElementOfType(selector, HTMLElement);
}

export function queryInput(selector: string): HTMLInputElement {
  return queryElementOfType(selector, HTMLInputElement);
}

function persistServerUrl(url: URL, serverBaseUrl: URL): void {
  if (serverBaseUrl.origin === window.location.origin) return;
  url.searchParams.set("server", serverBaseUrl.href);
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
