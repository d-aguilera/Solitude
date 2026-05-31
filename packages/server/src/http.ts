import {
  createErrorMessage,
  isSolitudeSocketClientMessage,
  type SnapshotMessage,
  type SolitudeClientMessage,
  type SolitudeGameId,
  type SolitudeProtocolSequence,
  type SolitudeServerMessage,
  type SolitudeSocketClientMessage,
} from "@solitude/protocol/protocol";
import { constants, statSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { extname, normalize, resolve, sep } from "node:path";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import {
  DEFAULT_SOLITUDE_METRICS_WINDOW_MILLIS,
  createSolitudeServerMetrics,
  measureSnapshotEncodingByteLengths,
  type SolitudeServerMetrics,
} from "./metrics";
import {
  createDefaultSolitudeGameRunner,
  type SolitudeGameRunner,
  type SolitudeGameRunnerFactory,
  type SolitudeRunningGameSummary,
} from "./runner";

export interface SolitudeHttpServerOptions {
  createRunner: SolitudeGameRunnerFactory;
  devAssetHandler?: SolitudeDevAssetHandler;
  hostname: string;
  port: number;
  staticAssetRoot?: string;
}

export interface SolitudeHttpServer {
  close: () => Promise<void>;
  server: ReturnType<typeof createServer>;
  url: string;
}

export interface SolitudeHttpRequestHandler {
  (request: IncomingMessage, response: ServerResponse): Promise<void>;
  close: () => void;
  handleUpgrade: (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => void;
}

export interface SolitudeDevAssetHandler {
  (request: IncomingMessage, response: ServerResponse): Promise<boolean>;
}

export interface SolitudeHttpRequestHandlerOptions {
  createRunner: SolitudeGameRunnerFactory;
  devAssetHandler?: SolitudeDevAssetHandler;
  staticAssetRoot?: string;
}

export function createDefaultSolitudeHttpServerOptions(): SolitudeHttpServerOptions {
  return {
    createRunner: createDefaultSolitudeGameRunner,
    hostname: "127.0.0.1",
    port: 8787,
  };
}

export function createSolitudeHttpRequestHandler({
  createRunner,
  devAssetHandler,
  staticAssetRoot,
}: SolitudeHttpRequestHandlerOptions): SolitudeHttpRequestHandler {
  const socketSubscriptionsByGameId = new Map<SolitudeGameId, Set<WebSocket>>();
  const socketSessionsBySocket = new Map<WebSocket, SocketSession>();
  const socketServer = new WebSocketServer({ noServer: true });
  const metrics = createSolitudeServerMetrics({
    nowMillis: Date.now,
    windowMillis: DEFAULT_SOLITUDE_METRICS_WINDOW_MILLIS,
  });
  const runner = createRunner({
    metrics,
    onSnapshot: (snapshot) => {
      publishSocketSnapshot(socketSubscriptionsByGameId, metrics, snapshot);
    },
  });
  const resolvedStaticAssetRoot = staticAssetRoot
    ? resolve(staticAssetRoot)
    : null;

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

    if (request.method === "GET" && requestUrl.pathname === "/games") {
      sendGameList(response, runner.listGames());
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/metrics") {
      sendJson(
        response,
        200,
        metrics.createReport({
          connectedSockets: socketServer.clients.size,
          games: runner.listGames(),
          getClientCount: (gameId) =>
            socketSubscriptionsByGameId.get(gameId)?.size ?? 0,
        }),
      );
      return;
    }

    if (
      request.method === "GET" &&
      resolvedStaticAssetRoot &&
      (await sendStaticAsset(
        response,
        resolvedStaticAssetRoot,
        requestUrl.pathname,
      ))
    ) {
      return;
    }

    if (devAssetHandler && (await devAssetHandler(request, response))) {
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
    runner.close();
    socketServer.close();
    for (const sockets of socketSubscriptionsByGameId.values()) {
      for (const socket of sockets) {
        socket.close();
      }
    }
    socketSubscriptionsByGameId.clear();
  };
  handler.handleUpgrade = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    if (requestUrl.pathname !== "/socket") {
      socket.destroy();
      return;
    }
    socketServer.handleUpgrade(request, socket, head, (webSocket) => {
      socketServer.emit("connection", webSocket, request);
      attachWebSocketTransport({
        runner,
        socket: webSocket,
        socketSessionsBySocket,
        socketSubscriptionsByGameId,
      });
    });
  };
  return handler;
}

export async function startSolitudeHttpServer(
  options: SolitudeHttpServerOptions,
): Promise<SolitudeHttpServer> {
  const handler = createSolitudeHttpRequestHandler(options);
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
  server.on(
    "upgrade",
    (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      handler.handleUpgrade(request, socket, head);
    },
  );

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

interface AttachWebSocketTransportOptions {
  runner: SolitudeGameRunner;
  socket: WebSocket;
  socketSessionsBySocket: Map<WebSocket, SocketSession>;
  socketSubscriptionsByGameId: Map<SolitudeGameId, Set<WebSocket>>;
}

interface SocketSession {
  clientId: string;
  gameId: SolitudeGameId;
}

function attachWebSocketTransport({
  runner,
  socket,
  socketSessionsBySocket,
  socketSubscriptionsByGameId,
}: AttachWebSocketTransportOptions): void {
  socket.send(JSON.stringify({ type: "ready" }));
  socket.on("message", (data) => {
    const payload = readSocketPayload(data);
    if (!isSolitudeSocketClientMessage(payload)) {
      sendSocketMessages(socket, 0, [
        createErrorMessage({
          code: "invalidMessage",
          message: "Invalid socket message",
          sequence: 0,
        }),
      ]);
      return;
    }
    handleSocketMessage({
      payload,
      runner,
      socket,
      socketSessionsBySocket,
      socketSubscriptionsByGameId,
    });
  });
  socket.on("close", () => {
    const session = socketSessionsBySocket.get(socket);
    socketSessionsBySocket.delete(socket);
    removeSocketFromAllSubscriptions(socketSubscriptionsByGameId, socket);
    if (session) {
      const messages = runner.receive(
        {
          type: "leaveGame",
          clientId: session.clientId,
          gameId: session.gameId,
          sequence: 0,
        },
        0,
      );
      publishSocketModelMessages(
        socketSubscriptionsByGameId,
        session.gameId,
        messages,
      );
    }
  });
}

interface HandleSocketMessageOptions {
  payload: SolitudeSocketClientMessage;
  runner: SolitudeGameRunner;
  socket: WebSocket;
  socketSessionsBySocket: Map<WebSocket, SocketSession>;
  socketSubscriptionsByGameId: Map<SolitudeGameId, Set<WebSocket>>;
}

function handleSocketMessage({
  payload,
  runner,
  socket,
  socketSessionsBySocket,
  socketSubscriptionsByGameId,
}: HandleSocketMessageOptions): void {
  switch (payload.type) {
    case "clientMessage": {
      const messages = runner.receive(
        payload.message,
        payload.message.sequence,
      );
      if (payload.message.type === "leaveGame") {
        removeSocketSubscription(
          socketSubscriptionsByGameId,
          socket,
          payload.message.gameId,
        );
        socketSessionsBySocket.delete(socket);
      }
      updateSocketSubscriptions(
        socketSubscriptionsByGameId,
        socketSessionsBySocket,
        socket,
        messages,
      );
      publishSocketModelMessages(
        socketSubscriptionsByGameId,
        getModelBroadcastGameId(payload.message, messages),
        messages,
        socket,
      );
      sendSocketMessages(socket, payload.requestId, messages);
      return;
    }
  }
}

function setCommonHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Headers", "content-type");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Origin", "*");
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  sendText(
    response,
    statusCode,
    "application/json; charset=utf-8",
    JSON.stringify(payload),
  );
}

function sendGameList(
  response: ServerResponse,
  games: readonly SolitudeRunningGameSummary[],
): void {
  sendText(
    response,
    200,
    "application/json; charset=utf-8",
    JSON.stringify({ games }),
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

function sendBuffer(
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: Buffer,
): void {
  response.writeHead(statusCode, { "content-type": contentType });
  response.end(body);
}

function sendSocketMessages(
  socket: WebSocket,
  requestId: SolitudeProtocolSequence,
  messages: SolitudeServerMessage[],
): void {
  sendSocketText(
    socket,
    JSON.stringify({ messages, requestId, type: "messages" }),
  );
}

function sendSocketServerMessage(
  socket: WebSocket,
  message: SolitudeServerMessage,
): void {
  sendSocketText(socket, JSON.stringify({ message, type: "serverMessage" }));
}

function sendSocketText(socket: WebSocket, text: string): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(text);
}

async function sendStaticAsset(
  response: ServerResponse,
  root: string,
  pathname: string,
): Promise<boolean> {
  const assetPath = resolveStaticAssetPath(root, pathname);
  if (!assetPath) return false;

  try {
    await access(assetPath, constants.R_OK);
    if (statSync(assetPath).isDirectory()) return false;
    sendBuffer(
      response,
      200,
      getContentType(assetPath),
      await readFile(assetPath),
    );
    return true;
  } catch (error) {
    if (isNodeErrorCode(error, "ENOENT")) return false;
    throw error;
  }
}

function resolveStaticAssetPath(root: string, pathname: string): string | null {
  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath =
    decodedPathname === "/" ? "index.html" : decodedPathname.slice(1);
  const normalizedRelativePath = normalize(relativePath);
  if (
    normalizedRelativePath.startsWith("..") ||
    normalizedRelativePath.includes(`${sep}..${sep}`)
  ) {
    return null;
  }

  const assetPath = resolve(root, normalizedRelativePath);
  return assetPath === root || assetPath.startsWith(`${root}${sep}`)
    ? assetPath
    : null;
}

function getContentType(filePath: string): string {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".ico":
      return "image/x-icon";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
    case ".map":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function publishSocketSnapshot(
  subscriptionsByGameId: Map<SolitudeGameId, Set<WebSocket>>,
  metrics: SolitudeServerMetrics,
  snapshot: SnapshotMessage,
): void {
  const subscriptions = subscriptionsByGameId.get(snapshot.gameId);
  if (!subscriptions) return;
  const serializeStartMillis = Date.now();
  const payload = JSON.stringify({ message: snapshot, type: "serverMessage" });
  const byteLength = Buffer.byteLength(payload);
  metrics.recordSnapshotBroadcast({
    byteLength,
    clientCount: subscriptions.size,
    encodingByteLengths: measureSnapshotEncodingByteLengths(
      snapshot,
      byteLength,
    ),
    gameId: snapshot.gameId,
    serializeDurationMillis: Math.max(0, Date.now() - serializeStartMillis),
  });
  for (const socket of subscriptions) {
    sendSocketText(socket, payload);
  }
}

function updateSocketSubscriptions(
  subscriptionsByGameId: Map<SolitudeGameId, Set<WebSocket>>,
  socketSessionsBySocket: Map<WebSocket, SocketSession>,
  socket: WebSocket,
  messages: readonly SolitudeServerMessage[],
): void {
  for (const message of messages) {
    if (message.type === "joined") {
      addSocketSubscription(subscriptionsByGameId, socket, message.gameId);
      socketSessionsBySocket.set(socket, {
        clientId: message.clientId,
        gameId: message.gameId,
      });
    }
  }
}

function getModelBroadcastGameId(
  message: SolitudeClientMessage,
  messages: readonly SolitudeServerMessage[],
): SolitudeGameId | null {
  for (const responseMessage of messages) {
    if (responseMessage.type === "gameModel") {
      return responseMessage.gameId;
    }
  }
  return message.type === "joinGame" || message.type === "leaveGame"
    ? message.gameId
    : null;
}

function publishSocketModelMessages(
  subscriptionsByGameId: Map<SolitudeGameId, Set<WebSocket>>,
  gameId: SolitudeGameId | null,
  messages: readonly SolitudeServerMessage[],
  exceptSocket?: WebSocket,
): void {
  if (!gameId) return;
  const subscriptions = subscriptionsByGameId.get(gameId);
  if (!subscriptions) return;
  for (const message of messages) {
    if (message.type !== "gameModel") continue;
    for (const socket of subscriptions) {
      if (socket === exceptSocket) continue;
      sendSocketServerMessage(socket, message);
    }
  }
}

function addSocketSubscription(
  subscriptionsByGameId: Map<SolitudeGameId, Set<WebSocket>>,
  socket: WebSocket,
  gameId: SolitudeGameId,
): void {
  let subscriptions = subscriptionsByGameId.get(gameId);
  if (!subscriptions) {
    subscriptions = new Set();
    subscriptionsByGameId.set(gameId, subscriptions);
  }
  subscriptions.add(socket);
}

function removeSocketSubscription(
  subscriptionsByGameId: Map<SolitudeGameId, Set<WebSocket>>,
  socket: WebSocket,
  gameId: SolitudeGameId,
): void {
  const subscriptions = subscriptionsByGameId.get(gameId);
  if (!subscriptions) return;
  subscriptions.delete(socket);
  if (subscriptions.size === 0) {
    subscriptionsByGameId.delete(gameId);
  }
}

function removeSocketFromAllSubscriptions(
  subscriptionsByGameId: Map<SolitudeGameId, Set<WebSocket>>,
  socket: WebSocket,
): void {
  for (const [gameId, subscriptions] of subscriptionsByGameId) {
    subscriptions.delete(socket);
    if (subscriptions.size === 0) {
      subscriptionsByGameId.delete(gameId);
    }
  }
}

function readSocketPayload(data: RawData): unknown {
  const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isNodeErrorCode(value: unknown, code: string): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    "code" in value &&
    value.code === code
  );
}
