import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import {
  createDefaultSolitudeHttpServerOptions,
  startSolitudeHttpServer,
  type SolitudeHttpServer,
} from "../http";

describe("Solitude HTTP server", () => {
  it("serves the interactive probe page", async () => {
    const server = await startSolitudeHttpServer({
      ...createDefaultSolitudeHttpServerOptions(),
      devAssetHandler: async (request, response) => {
        if (request.url === "/") {
          response.writeHead(200, { "content-type": "text/html" });
          response.end('Solitude<script type="module" src="/src/lobby.ts">');
          return true;
        }
        if (request.url === "/game.html") {
          response.writeHead(200, { "content-type": "text/html" });
          response.end('<script type="module" src="/src/remoteClient.ts">');
          return true;
        }
        if (request.url === "/game.css" || request.url === "/lobby.css") {
          response.writeHead(200, { "content-type": "text/css" });
          response.end("body{}");
          return true;
        }
        return false;
      },
      port: 0,
    });
    try {
      const response = await fetch(`${server.url}/`);

      expect(response.status).toBe(200);
      const page = await response.text();
      expect(page).toContain("Solitude");
      expect(page).toContain("/src/lobby.ts");

      const gamePageResponse = await fetch(`${server.url}/game.html`);
      expect(await gamePageResponse.text()).toContain("/src/remoteClient.ts");

      const stylesheetResponse = await fetch(`${server.url}/game.css`);
      expect(stylesheetResponse.status).toBe(200);
      const lobbyStylesheetResponse = await fetch(`${server.url}/lobby.css`);
      expect(lobbyStylesheetResponse.status).toBe(200);
    } finally {
      await server.close();
    }
  });

  it("serves built remote client assets when a static asset root is configured", async () => {
    const assetRoot = await mkdtemp(join(tmpdir(), "solitude-dist-"));
    await mkdir(join(assetRoot, "assets"));
    await writeFile(
      join(assetRoot, "game.html"),
      '<script type="module" src="/assets/game.js"></script>',
    );
    await writeFile(
      join(assetRoot, "index.html"),
      '<script type="module" src="/assets/index.js"></script>',
    );
    await writeFile(join(assetRoot, "assets", "game.js"), "export {};");
    await writeFile(join(assetRoot, "games"), "not the API");

    const server = await startSolitudeHttpServer({
      ...createDefaultSolitudeHttpServerOptions(),
      port: 0,
      staticAssetRoot: assetRoot,
    });
    try {
      const rootResponse = await fetch(`${server.url}/`);
      expect(await rootResponse.text()).toContain("/assets/index.js");

      const gameResponse = await fetch(`${server.url}/game.html`);
      expect(await gameResponse.text()).toContain("/assets/game.js");

      const indexResponse = await fetch(`${server.url}/index.html`);
      expect(await indexResponse.text()).toContain("/assets/index.js");

      const scriptResponse = await fetch(`${server.url}/assets/game.js`);
      expect(scriptResponse.headers.get("content-type")).toContain(
        "text/javascript",
      );
      expect(await scriptResponse.text()).toBe("export {};");

      const gamesResponse = await fetch(`${server.url}/games`);
      expect(await gamesResponse.json()).toEqual({ games: [] });
    } finally {
      await server.close();
      await rm(assetRoot, { force: true, recursive: true });
    }
  });

  it("does not expose legacy HTTP gameplay routes", async () => {
    const server = await startTestServer();
    try {
      for (const path of ["/message", "/step", "/run", "/pause"]) {
        const response = await fetch(`${server.url}${path}`, {
          body: "{}",
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        expect(response.status).toBe(404);
      }
      const eventsResponse = await fetch(
        `${server.url}/events?gameId=game%3A1`,
      );
      expect(eventsResponse.status).toBe(404);
      const deleteResponse = await fetch(`${server.url}/games/game%3A1`, {
        method: "DELETE",
      });
      expect(deleteResponse.status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("serves game summaries", async () => {
    const server = await startTestServer();
    try {
      const socket = await openWebSocket(`${server.url}/socket`);
      await createGameOverSocket(socket, "client:a", 1);

      const response = await fetch(`${server.url}/games`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        games: [
          {
            assignedEntityIds: [],
            availableEntityIds: ["ship:blue", "ship:red"],
            gameId: "game:1",
            maxClients: 2,
            running: false,
            tick: 0,
          },
        ],
      });
      await socket.close();
    } finally {
      await server.close();
    }
  });

  it("serves a health endpoint over HTTP", async () => {
    const server = await startTestServer();
    try {
      const response = await fetch(`${server.url}/health`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    } finally {
      await server.close();
    }
  });

  it("cleans up empty games after clients leave", async () => {
    const server = await startTestServer();
    try {
      const socket = await openWebSocket(`${server.url}/socket`);
      await createGameOverSocket(socket, "client:a", 1);
      await joinGameOverSocket(socket, "client:a", 2, 2);
      await runGameOverSocket(socket, 3);

      const runningResponse = await fetch(`${server.url}/games`);
      expect(await runningResponse.json()).toEqual({
        games: [
          {
            assignedEntityIds: ["ship:blue"],
            availableEntityIds: ["ship:red"],
            gameId: "game:1",
            maxClients: 2,
            running: true,
            tick: expect.any(Number),
          },
        ],
      });

      await leaveGameOverSocket(socket, "client:a", 4, 4);

      const response = await fetch(`${server.url}/games`);

      expect(await response.json()).toEqual({ games: [] });
      await socket.close();
    } finally {
      await server.close();
    }
  });

  it("can delegate dev-only browser module requests", async () => {
    const server = await startSolitudeHttpServer({
      ...createDefaultSolitudeHttpServerOptions(),
      devAssetHandler: async (_request, response) => {
        response.writeHead(200, { "content-type": "text/javascript" });
        response.end("export const ok = true;");
        return true;
      },
      port: 0,
    });
    try {
      const response = await fetch(`${server.url}/packages/app/module.ts`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("export const ok = true;");
    } finally {
      await server.close();
    }
  });

  it("routes interactive runtime traffic over WebSocket", async () => {
    const server = await startTestServer();
    try {
      const socket = await openWebSocket(`${server.url}/socket`);
      const createResponsePromise = socket.readUntil(
        (message) => message.type === "messages" && message.requestId === 1,
      );
      socket.send({
        type: "clientMessage",
        requestId: 1,
        message: {
          type: "createGame",
          clientId: "client:a",
          sequence: 1,
        },
      });

      const createResponse = await createResponsePromise;
      expect(withoutGameModels(createResponse.messages)).toEqual([
        {
          type: "gameCreated",
          clientId: "client:a",
          gameId: "game:1",
          sequence: 1,
        },
      ]);

      const joinResponsePromise = socket.readUntil(
        (message) => message.type === "messages" && message.requestId === 2,
      );
      socket.send({
        type: "clientMessage",
        requestId: 2,
        message: {
          type: "joinGame",
          clientId: "client:a",
          gameId: "game:1",
          sequence: 2,
        },
      });
      expect(withoutGameModels((await joinResponsePromise).messages)).toEqual([
        {
          type: "joined",
          clientId: "client:a",
          entityId: "ship:blue",
          gameId: "game:1",
          sequence: 2,
        },
      ]);

      const snapshotPromise = socket.readUntil(
        (message) =>
          message.type === "serverMessage" &&
          message.message?.type === "snapshot",
      );
      socket.send({
        type: "runGame",
        requestId: 3,
        gameId: "game:1",
      });

      const snapshot = await snapshotPromise;
      expect(snapshot.message.tick).toBeGreaterThan(0);
      socket.close();
    } finally {
      await server.close();
    }
  });

  it("broadcasts model updates to existing sockets when another client joins", async () => {
    const server = await startTestServer();
    try {
      const firstSocket = await openWebSocket(`${server.url}/socket`);
      const secondSocket = await openWebSocket(`${server.url}/socket`);

      const firstCreateResponse = firstSocket.readUntil(
        (message) => message.type === "messages" && message.requestId === 1,
      );
      firstSocket.send({
        type: "clientMessage",
        requestId: 1,
        message: {
          type: "createGame",
          clientId: "client:a",
          sequence: 1,
        },
      });
      await firstCreateResponse;

      const firstJoinResponse = firstSocket.readUntil(
        (message) => message.type === "messages" && message.requestId === 2,
      );
      firstSocket.send({
        type: "clientMessage",
        requestId: 2,
        message: {
          type: "joinGame",
          clientId: "client:a",
          gameId: "game:1",
          sequence: 2,
        },
      });
      await firstJoinResponse;

      const firstModelUpdate = firstSocket.readUntil(
        (message) =>
          message.type === "serverMessage" &&
          message.message?.type === "gameModel",
      );
      const secondJoinResponse = secondSocket.readUntil(
        (message) => message.type === "messages" && message.requestId === 1,
      );
      secondSocket.send({
        type: "clientMessage",
        requestId: 1,
        message: {
          type: "joinGame",
          clientId: "client:b",
          gameId: "game:1",
          sequence: 1,
        },
      });

      const joinResponse = await secondJoinResponse;
      const modelUpdate = await firstModelUpdate;

      expect(
        joinResponse.messages
          .find((message: any) => message.type === "gameModel")
          ?.entities.map((entity: any) => entity.id),
      ).toEqual(["ship:blue", "ship:red"]);
      expect(
        modelUpdate.message.entities.map((entity: any) => entity.id),
      ).toEqual(["ship:blue", "ship:red"]);

      firstSocket.close();
      secondSocket.close();
    } finally {
      await server.close();
    }
  });

  it("releases only a socket's assigned ship when the socket closes", async () => {
    const server = await startTestServer();
    try {
      const firstSocket = await openWebSocket(`${server.url}/socket`);
      const secondSocket = await openWebSocket(`${server.url}/socket`);

      const createResponse = firstSocket.readUntil(
        (message) => message.type === "messages" && message.requestId === 1,
      );
      firstSocket.send({
        type: "clientMessage",
        requestId: 1,
        message: {
          type: "createGame",
          clientId: "client:a",
          sequence: 1,
        },
      });
      await createResponse;

      const firstJoinResponse = firstSocket.readUntil(
        (message) => message.type === "messages" && message.requestId === 2,
      );
      firstSocket.send({
        type: "clientMessage",
        requestId: 2,
        message: {
          type: "joinGame",
          clientId: "client:a",
          gameId: "game:1",
          sequence: 2,
        },
      });
      await firstJoinResponse;

      const joinResponse = secondSocket.readUntil(
        (message) => message.type === "messages" && message.requestId === 1,
      );
      secondSocket.send({
        type: "clientMessage",
        requestId: 1,
        message: {
          type: "joinGame",
          clientId: "client:b",
          gameId: "game:1",
          sequence: 1,
        },
      });
      await joinResponse;

      await firstSocket.close();
      const games = await waitForGameList(server, (items) =>
        JSON.stringify(items).includes('"availableEntityIds":["ship:blue"]'),
      );

      expect(games).toEqual([
        {
          assignedEntityIds: ["ship:red"],
          availableEntityIds: ["ship:blue"],
          gameId: "game:1",
          maxClients: 2,
          running: false,
          tick: 0,
        },
      ]);
      await secondSocket.close();
    } finally {
      await server.close();
    }
  });
});

async function startTestServer(): Promise<SolitudeHttpServer> {
  return startSolitudeHttpServer({
    ...createDefaultSolitudeHttpServerOptions(),
    port: 0,
  });
}

function withoutGameModels(messages: any[]): any[] {
  return messages.filter((message) => message.type !== "gameModel");
}

async function openWebSocket(url: string): Promise<{
  close: () => Promise<void>;
  readUntil: (predicate: (message: any) => boolean) => Promise<any>;
  send: (payload: unknown) => void;
}> {
  const socket = new WebSocket(url.replace(/^http/, "ws"));
  const messages: any[] = [];
  const waiters: Array<{
    predicate: (message: any) => boolean;
    resolve: (message: any) => void;
  }> = [];

  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  socket.on("message", (data) => {
    const message = JSON.parse(data.toString()) as any;
    messages.push(message);
    for (let i = waiters.length - 1; i >= 0; i--) {
      const waiter = waiters[i];
      if (waiter.predicate(message)) {
        waiters.splice(i, 1);
        waiter.resolve(message);
      }
    }
  });

  return {
    close: () =>
      new Promise<void>((resolve) => {
        if (
          socket.readyState === WebSocket.CLOSED ||
          socket.readyState === WebSocket.CLOSING
        ) {
          resolve();
          return;
        }
        socket.once("close", resolve);
        socket.close();
      }),
    readUntil: (predicate) => {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve) => {
        waiters.push({ predicate, resolve });
      });
    },
    send: (payload) => {
      socket.send(JSON.stringify(payload));
    },
  };
}

async function waitForGameList(
  server: SolitudeHttpServer,
  predicate: (games: unknown[]) => boolean,
): Promise<unknown[]> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await fetch(`${server.url}/games`);
    const payload = (await response.json()) as { games: unknown[] };
    if (Array.isArray(payload.games) && predicate(payload.games)) {
      return payload.games;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for game list");
}

async function createGameOverSocket(
  socket: Awaited<ReturnType<typeof openWebSocket>>,
  clientId: string,
  requestId: number,
): Promise<void> {
  const response = socket.readUntil(
    (message) => message.type === "messages" && message.requestId === requestId,
  );
  socket.send({
    type: "clientMessage",
    requestId,
    message: {
      type: "createGame",
      clientId,
      sequence: requestId,
    },
  });
  await response;
}

async function joinGameOverSocket(
  socket: Awaited<ReturnType<typeof openWebSocket>>,
  clientId: string,
  requestId: number,
  sequence: number,
): Promise<void> {
  const response = socket.readUntil(
    (message) => message.type === "messages" && message.requestId === requestId,
  );
  socket.send({
    type: "clientMessage",
    requestId,
    message: {
      type: "joinGame",
      clientId,
      gameId: "game:1",
      sequence,
    },
  });
  await response;
}

async function leaveGameOverSocket(
  socket: Awaited<ReturnType<typeof openWebSocket>>,
  clientId: string,
  requestId: number,
  sequence: number,
): Promise<void> {
  const response = socket.readUntil(
    (message) => message.type === "messages" && message.requestId === requestId,
  );
  socket.send({
    type: "clientMessage",
    requestId,
    message: {
      type: "leaveGame",
      clientId,
      gameId: "game:1",
      sequence,
    },
  });
  await response;
}

async function runGameOverSocket(
  socket: Awaited<ReturnType<typeof openWebSocket>>,
  requestId: number,
): Promise<void> {
  const response = socket.readUntil(
    (message) => message.type === "messages" && message.requestId === requestId,
  );
  socket.send({
    type: "runGame",
    requestId,
    gameId: "game:1",
  });
  await response;
}
