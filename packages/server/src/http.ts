import { readFileSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import {
  createErrorMessage,
  type SnapshotMessage,
  type SolitudeGameId,
  type SolitudeProtocolSequence,
  type SolitudeServerMessage,
} from "./protocol";
import { createSolitudeGameTicker } from "./ticker";
import {
  createSolitudeInProcessTransport,
  type SolitudeInProcessTransport,
} from "./transport";

const MAX_REQUEST_BODY_BYTES = 64 * 1024;

export interface SolitudeHttpServerOptions {
  hostname: string;
  port: number;
  transport: SolitudeInProcessTransport;
}

export interface SolitudeHttpServer {
  close: () => Promise<void>;
  server: ReturnType<typeof createServer>;
  url: string;
}

export interface SolitudeHttpRequestHandler {
  (request: IncomingMessage, response: ServerResponse): Promise<void>;
  close: () => void;
}

interface StepRequest {
  dtMillis: number;
  gameId: SolitudeGameId;
}

interface RunRequest extends StepRequest {
  intervalMillis: number;
}

export function createDefaultSolitudeHttpServerOptions(): SolitudeHttpServerOptions {
  return {
    hostname: "127.0.0.1",
    port: 8787,
    transport: createSolitudeInProcessTransport(),
  };
}

export function createSolitudeHttpRequestHandler(
  transport: SolitudeInProcessTransport,
): SolitudeHttpRequestHandler {
  const subscriptionsByGameId = new Map<SolitudeGameId, Set<ServerResponse>>();
  const ticker = createSolitudeGameTicker({
    onSnapshot: (snapshot) => publishSnapshot(subscriptionsByGameId, snapshot),
    transport,
  });

  const handler = async (
    request: IncomingMessage,
    response: ServerResponse,
  ) => {
    setCommonHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const requestUrl = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "GET" && requestUrl.pathname === "/") {
      sendText(response, 200, "text/html; charset=utf-8", DEMO_PAGE_HTML);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/probe.js") {
      sendText(response, 200, "text/javascript; charset=utf-8", PROBE_JS);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/probe.css") {
      sendText(response, 200, "text/css; charset=utf-8", PROBE_CSS);
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/events") {
      const gameId = requestUrl.searchParams.get("gameId");
      if (!gameId) {
        sendJson(response, 400, {
          messages: [
            createErrorMessage({
              code: "invalidRequest",
              message: "Missing gameId",
              sequence: 0,
            }),
          ],
        });
        return;
      }
      subscribe(response, request, subscriptionsByGameId, gameId);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/message") {
      const payload = await readJsonBody(request);
      const sequence = getFallbackSequence(payload);
      sendJson(response, 200, {
        messages: transport.receive(payload, sequence),
      });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/step") {
      const payload = await readJsonBody(request);
      if (!isStepRequest(payload)) {
        sendJson(response, 400, {
          messages: [
            createErrorMessage({
              code: "invalidRequest",
              message: "Invalid step request",
              sequence: 0,
            }),
          ],
        });
        return;
      }

      const snapshot = transport.stepGame(payload.gameId, payload.dtMillis);
      if (!snapshot) {
        sendJson(response, 404, {
          messages: [
            createErrorMessage({
              code: "gameNotFound",
              message: `Game not found: ${payload.gameId}`,
              sequence: 0,
            }),
          ],
        });
        return;
      }

      publishSnapshot(subscriptionsByGameId, snapshot);
      sendJson(response, 200, { messages: [snapshot] });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/run") {
      const payload = await readJsonBody(request);
      if (!isRunRequest(payload)) {
        sendJson(response, 400, {
          messages: [
            createErrorMessage({
              code: "invalidRequest",
              message: "Invalid run request",
              sequence: 0,
            }),
          ],
        });
        return;
      }

      ticker.runGame(payload);
      sendJson(response, 200, { messages: [] });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/pause") {
      const payload = await readJsonBody(request);
      if (!isPauseRequest(payload)) {
        sendJson(response, 400, {
          messages: [
            createErrorMessage({
              code: "invalidRequest",
              message: "Invalid pause request",
              sequence: 0,
            }),
          ],
        });
        return;
      }

      ticker.pauseGame(payload.gameId);
      sendJson(response, 200, { messages: [] });
      return;
    }

    sendJson(response, 404, {
      messages: [
        createErrorMessage({
          code: "notFound",
          message: `Route not found: ${request.method ?? "UNKNOWN"} ${requestUrl.pathname}`,
          sequence: 0,
        }),
      ],
    });
  };

  handler.close = () => {
    ticker.pauseAll();
  };
  return handler;
}

export async function startSolitudeHttpServer(
  options: SolitudeHttpServerOptions,
): Promise<SolitudeHttpServer> {
  const handler = createSolitudeHttpRequestHandler(options.transport);
  const server = createServer((request, response) => {
    void handler(request, response).catch((error: unknown) => {
      sendJson(response, 500, {
        messages: [
          createErrorMessage({
            code: "internalServerError",
            message:
              error instanceof Error ? error.message : "Internal server error",
            sequence: 0,
          }),
        ],
      });
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port, options.hostname, resolve);
  });

  const address = server.address() as AddressInfo;
  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        handler.close();
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
    server,
    url: `http://${options.hostname}:${address.port}`,
  };
}

function setCommonHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Headers", "content-type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Origin", "*");
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: { messages: SolitudeServerMessage[] },
): void {
  sendText(
    response,
    statusCode,
    "application/json; charset=utf-8",
    JSON.stringify(payload),
  );
}

function sendText(
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: string,
): void {
  response.writeHead(statusCode, { "content-type": contentType });
  response.end(body);
}

function subscribe(
  response: ServerResponse,
  request: IncomingMessage,
  subscriptionsByGameId: Map<SolitudeGameId, Set<ServerResponse>>,
  gameId: SolitudeGameId,
): void {
  let subscriptions = subscriptionsByGameId.get(gameId);
  if (!subscriptions) {
    subscriptions = new Set();
    subscriptionsByGameId.set(gameId, subscriptions);
  }
  subscriptions.add(response);

  response.writeHead(200, {
    "cache-control": "no-cache",
    connection: "keep-alive",
    "content-type": "text/event-stream",
  });
  response.flushHeaders();
  response.write(`event: ready\ndata: ${JSON.stringify({ gameId })}\n\n`);

  request.on("close", () => {
    subscriptions?.delete(response);
    if (subscriptions?.size === 0) {
      subscriptionsByGameId.delete(gameId);
    }
  });
}

function publishSnapshot(
  subscriptionsByGameId: Map<SolitudeGameId, Set<ServerResponse>>,
  snapshot: SnapshotMessage,
): void {
  const subscriptions = subscriptionsByGameId.get(snapshot.gameId);
  if (!subscriptions) return;
  const data = JSON.stringify(snapshot);
  for (const response of subscriptions) {
    response.write(`data: ${data}\n\n`);
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let byteLength = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.byteLength;
    if (byteLength > MAX_REQUEST_BODY_BYTES) {
      throw new Error("Request body is too large");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function getFallbackSequence(payload: unknown): SolitudeProtocolSequence {
  if (!isRecord(payload)) return 0;
  return typeof payload.sequence === "number" &&
    Number.isFinite(payload.sequence)
    ? payload.sequence
    : 0;
}

function isStepRequest(value: unknown): value is StepRequest {
  return (
    isRecord(value) &&
    typeof value.gameId === "string" &&
    typeof value.dtMillis === "number" &&
    Number.isFinite(value.dtMillis) &&
    value.dtMillis > 0
  );
}

function isRunRequest(value: unknown): value is RunRequest {
  return (
    isRecord(value) &&
    typeof value.gameId === "string" &&
    typeof value.dtMillis === "number" &&
    Number.isFinite(value.dtMillis) &&
    value.dtMillis > 0 &&
    typeof value.intervalMillis === "number" &&
    Number.isFinite(value.intervalMillis) &&
    value.intervalMillis >= 10
  );
}

function isPauseRequest(value: unknown): value is { gameId: SolitudeGameId } {
  return isRecord(value) && typeof value.gameId === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const DEMO_PAGE_HTML = readFileSync(
  new URL("./probe.html", import.meta.url),
  "utf8",
);
const PROBE_JS = readFileSync(new URL("./probe.js", import.meta.url), "utf8");
const PROBE_CSS = readFileSync(new URL("./probe.css", import.meta.url), "utf8");
