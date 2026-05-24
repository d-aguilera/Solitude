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

export type SolitudeHttpRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;

interface StepRequest {
  dtMillis: number;
  gameId: SolitudeGameId;
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

  return async (request, response) => {
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
    Number.isFinite(value.dtMillis)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const DEMO_PAGE_HTML = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Solitude Server Probe</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #111615;
        color: #eef3ef;
      }
      body {
        margin: 0;
      }
      main {
        display: grid;
        gap: 18px;
        margin: 0 auto;
        max-width: 980px;
        padding: 28px;
      }
      h1 {
        font-size: 24px;
        font-weight: 650;
        margin: 0;
      }
      section {
        border: 1px solid #2c3936;
        border-radius: 8px;
        padding: 16px;
      }
      .grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }
      label {
        display: grid;
        gap: 6px;
        font-size: 13px;
        color: #b8c6bf;
      }
      input {
        background: #0a0d0c;
        border: 1px solid #354540;
        border-radius: 6px;
        color: #eef3ef;
        font: inherit;
        padding: 9px 10px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      button {
        background: #d7f3de;
        border: 0;
        border-radius: 6px;
        color: #0b120d;
        cursor: pointer;
        font: inherit;
        font-weight: 650;
        min-height: 40px;
        padding: 9px 13px;
      }
      button.secondary {
        background: #263430;
        color: #eef3ef;
      }
      pre {
        background: #080b0a;
        border-radius: 8px;
        color: #d7e6dc;
        margin: 0;
        min-height: 260px;
        overflow: auto;
        padding: 14px;
        white-space: pre-wrap;
      }
      .status {
        color: #a9bab2;
        font-variant-numeric: tabular-nums;
      }
      .run-state {
        color: #d7f3de;
      }
      .key-state {
        color: #d7e6dc;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Solitude Server Probe</h1>
      <section class="grid">
        <label>Client <input id="clientId" value="client:a" /></label>
        <label>Game <input id="gameId" placeholder="game:1" /></label>
        <label>Entity <input id="entityId" placeholder="ship:blue" /></label>
        <label>Step millis <input id="dtMillis" type="number" value="1000" /></label>
        <label>Run interval <input id="runIntervalMillis" type="number" value="250" /></label>
      </section>
      <section class="actions">
        <button id="createGame">Create game</button>
        <button id="joinGame" class="secondary">Join game</button>
        <button id="connectEvents" class="secondary">Reconnect stream</button>
        <button id="toggleBurn" class="secondary">Start forward burn</button>
        <button id="stepGame">Step</button>
        <button id="toggleRun" class="secondary">Run</button>
      </section>
      <section>
        <div id="status" class="status">Snapshot stream waiting for a game</div>
        <div id="runStatus" class="status run-state">Paused</div>
        <div id="keyStatus" class="status key-state">Keyboard controls idle</div>
      </section>
      <pre id="log"></pre>
    </main>
    <script>
      let sequence = 1;
      let burnHeld = false;
      let events = null;
      let runTimer = 0;
      const heldControls = {};
      const keyMap = {
        Digit0: "thrust0",
        Digit1: "thrust1",
        Digit2: "thrust2",
        Digit3: "thrust3",
        Digit4: "thrust4",
        Digit5: "thrust5",
        Digit6: "thrust6",
        Digit7: "thrust7",
        Digit8: "thrust8",
        Digit9: "thrust9",
        KeyA: "yawLeft",
        KeyB: "burnBackwards",
        KeyD: "yawRight",
        KeyE: "rollRight",
        KeyM: "burnRight",
        KeyN: "burnLeft",
        KeyQ: "rollLeft",
        KeyS: "pitchDown",
        KeyW: "pitchUp",
        Space: "burnForward",
      };

      const fields = {
        clientId: document.querySelector("#clientId"),
        gameId: document.querySelector("#gameId"),
        entityId: document.querySelector("#entityId"),
        dtMillis: document.querySelector("#dtMillis"),
        runIntervalMillis: document.querySelector("#runIntervalMillis"),
      };
      const logEl = document.querySelector("#log");
      const keyStatusEl = document.querySelector("#keyStatus");
      const statusEl = document.querySelector("#status");
      const runStatusEl = document.querySelector("#runStatus");
      const toggleBurnButton = document.querySelector("#toggleBurn");
      const toggleRunButton = document.querySelector("#toggleRun");

      document.querySelector("#createGame").addEventListener("click", () => {
        sendMessage({ type: "createGame", clientId: fields.clientId.value, sequence: nextSequence() });
      });
      document.querySelector("#joinGame").addEventListener("click", () => {
        sendMessage({
          type: "joinGame",
          clientId: fields.clientId.value,
          gameId: fields.gameId.value,
          sequence: nextSequence(),
        });
      });
      document.querySelector("#connectEvents").addEventListener("click", connectEvents);
      toggleBurnButton.addEventListener("click", toggleForwardBurn);
      document.querySelector("#stepGame").addEventListener("click", stepGame);
      toggleRunButton.addEventListener("click", toggleRun);
      window.addEventListener("keydown", (event) => {
        void handleKeyboardInput(event, true);
      });
      window.addEventListener("keyup", (event) => {
        void handleKeyboardInput(event, false);
      });

      async function sendMessage(message) {
        const response = await fetch("/message", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(message),
        });
        const payload = await response.json();
        handleMessages(payload.messages, { connectAfterJoin: true });
      }

      async function stepGame() {
        if (!fields.gameId.value) {
          statusEl.textContent = "Create or join a game before stepping";
          return;
        }
        const response = await fetch("/step", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            gameId: fields.gameId.value,
            dtMillis: Number(fields.dtMillis.value),
          }),
        });
        const payload = await response.json();
        handleMessages(payload.messages, { suppressSnapshots: Boolean(events) });
      }

      async function handleKeyboardInput(event, isDown) {
        if (event.repeat || event.target instanceof HTMLInputElement) return;
        const action = keyMap[event.code];
        if (!action) return;
        event.preventDefault();
        if (!fields.gameId.value || !fields.entityId.value) {
          keyStatusEl.textContent = "Keyboard controls waiting for assigned entity";
          return;
        }
        if (heldControls[action] === isDown) return;
        heldControls[action] = isDown;
        keyStatusEl.textContent = action + " " + (isDown ? "held" : "released");
        await sendMessage({
          type: "input",
          clientId: fields.clientId.value,
          entityId: fields.entityId.value,
          gameId: fields.gameId.value,
          sequence: nextSequence(),
          controls: { [action]: isDown },
        });
      }

      function toggleForwardBurn() {
        if (!fields.gameId.value || !fields.entityId.value) {
          statusEl.textContent = "Create or join a game before sending input";
          return;
        }
        burnHeld = !burnHeld;
        heldControls.burnForward = burnHeld;
        if (burnHeld) heldControls.thrust5 = true;
        toggleBurnButton.textContent = burnHeld ? "Stop forward burn" : "Start forward burn";
        statusEl.textContent = burnHeld ? "Forward burn held" : "Forward burn released";
        sendMessage({
          type: "input",
          clientId: fields.clientId.value,
          entityId: fields.entityId.value,
          gameId: fields.gameId.value,
          sequence: nextSequence(),
          controls: burnHeld
            ? { burnForward: true, thrust5: true }
            : { burnForward: false },
        });
      }

      function toggleRun() {
        if (runTimer) {
          stopRunLoop();
          return;
        }
        if (!fields.gameId.value) {
          statusEl.textContent = "Create or join a game before running";
          return;
        }
        const intervalMillis = Math.max(50, Number(fields.runIntervalMillis.value) || 250);
        fields.runIntervalMillis.value = String(intervalMillis);
        runStatusEl.textContent = "Running every " + intervalMillis + " ms";
        toggleRunButton.textContent = "Pause";
        runTimer = window.setInterval(() => {
          void stepGame();
        }, intervalMillis);
        void stepGame();
      }

      function stopRunLoop() {
        window.clearInterval(runTimer);
        runTimer = 0;
        runStatusEl.textContent = "Paused";
        toggleRunButton.textContent = "Run";
      }

      function connectEvents() {
        if (!fields.gameId.value) {
          statusEl.textContent = "Create or join a game before connecting the snapshot stream";
          return;
        }
        if (events) events.close();
        events = new EventSource("/events?gameId=" + encodeURIComponent(fields.gameId.value));
        events.addEventListener("ready", (event) => {
          statusEl.textContent = "Snapshot stream connected for " + JSON.parse(event.data).gameId;
        });
        events.onmessage = (event) => {
          handleMessages([JSON.parse(event.data)]);
        };
        events.onerror = () => {
          statusEl.textContent = "SSE reconnecting";
        };
      }

      function handleMessages(messages, options = {}) {
        for (const message of messages) {
          if (message.type === "gameCreated") {
            fields.gameId.value = message.gameId;
          }
          if (message.type === "joined") {
            fields.gameId.value = message.gameId;
            fields.entityId.value = message.entityId;
            if (options.connectAfterJoin) connectEvents();
          }
          if (message.type === "snapshot") {
            if (options.suppressSnapshots) continue;
            statusEl.textContent =
              "tick " + message.tick + " | entities " + message.snapshot.entities.length;
          }
          log(message);
        }
      }

      function nextSequence() {
        const value = sequence;
        sequence += 1;
        return value;
      }

      function log(value) {
        logEl.textContent =
          JSON.stringify(value, null, 2) + "\n\n" + logEl.textContent.slice(0, 10000);
      }
    </script>
  </body>
</html>`;
