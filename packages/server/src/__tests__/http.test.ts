import { get } from "node:http";
import { describe, expect, it } from "vitest";
import {
  createDefaultSolitudeHttpServerOptions,
  startSolitudeHttpServer,
  type SolitudeHttpServer,
} from "../http";

describe("Solitude HTTP server", () => {
  it("serves the interactive probe page", async () => {
    const server = await startTestServer();
    try {
      const response = await fetch(`${server.url}/`);

      expect(response.status).toBe(200);
      const page = await response.text();
      expect(page).toContain("Solitude Remote Client");
      expect(page).toContain("/src/remoteClient.ts");

      const remotePageResponse = await fetch(`${server.url}/remote.html`);
      expect(await remotePageResponse.text()).toContain(
        "Solitude Remote Client",
      );

      const stylesheetResponse = await fetch(`${server.url}/remote.css`);
      expect(stylesheetResponse.status).toBe(200);
    } finally {
      await server.close();
    }
  });

  it("routes client messages through HTTP", async () => {
    const server = await startTestServer();
    try {
      const payload = await postJson(server, "/message", {
        type: "createGame",
        clientId: "client:a",
        sequence: 1,
      });

      expect(payload.messages).toEqual([
        {
          type: "gameCreated",
          clientId: "client:a",
          gameId: "game:1",
          sequence: 1,
        },
        {
          type: "joined",
          clientId: "client:a",
          entityId: "ship:blue",
          gameId: "game:1",
          sequence: 2,
        },
      ]);
    } finally {
      await server.close();
    }
  });

  it("serves game summaries", async () => {
    const server = await startTestServer();
    try {
      await postJson(server, "/message", {
        type: "createGame",
        clientId: "client:a",
        sequence: 1,
      });

      const response = await fetch(`${server.url}/games`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        games: [
          {
            assignedEntityIds: ["ship:blue"],
            availableEntityIds: ["ship:red"],
            gameId: "game:1",
            maxClients: 2,
            tick: 0,
          },
        ],
      });
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

  it("publishes snapshots over server-sent events when a game steps", async () => {
    const server = await startTestServer();
    try {
      await postJson(server, "/message", {
        type: "createGame",
        clientId: "client:a",
        sequence: 1,
      });

      const eventStream = await openEventStream(
        `${server.url}/events?gameId=game%3A1`,
      );
      const snapshotPromise = eventStream.readUntil('"type":"snapshot"');

      await postJson(server, "/step", {
        dtMillis: 1000,
        gameId: "game:1",
      });

      expect(await snapshotPromise).toContain('"tick":1');
      eventStream.close();
    } finally {
      await server.close();
    }
  });

  it("publishes snapshots from a server-owned run loop", async () => {
    const server = await startTestServer();
    try {
      await postJson(server, "/message", {
        type: "createGame",
        clientId: "client:a",
        sequence: 1,
      });

      const eventStream = await openEventStream(
        `${server.url}/events?gameId=game%3A1`,
      );
      const snapshotPromise = eventStream.readUntil('"type":"snapshot"');

      await postJson(server, "/run", {
        dtMillis: 1000,
        gameId: "game:1",
        intervalMillis: 10,
        simulationStepMillis: 1000,
      });

      expect(await snapshotPromise).toContain('"tick":1');
      await postJson(server, "/pause", { gameId: "game:1" });
      eventStream.close();
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

async function postJson(
  server: SolitudeHttpServer,
  path: string,
  payload: unknown,
): Promise<{ messages: unknown[] }> {
  const response = await fetch(`${server.url}${path}`, {
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return (await response.json()) as { messages: unknown[] };
}

async function openEventStream(url: string): Promise<{
  close: () => void;
  readUntil: (text: string) => Promise<string>;
}> {
  let received = "";
  const waiters: Array<{
    resolve: (value: string) => void;
    text: string;
  }> = [];

  const request = get(url);
  const stream = {
    close: () => {
      request.destroy();
    },
    readUntil: (text: string) => {
      if (received.includes(text)) return Promise.resolve(received);
      return new Promise<string>((resolve) => {
        waiters.push({ resolve, text });
      });
    },
  };

  return new Promise((resolve, reject) => {
    request.on("error", reject);
    request.on("response", (response) => {
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        received += chunk;
        for (let i = waiters.length - 1; i >= 0; i--) {
          const waiter = waiters[i];
          if (received.includes(waiter.text)) {
            waiters.splice(i, 1);
            waiter.resolve(received);
          }
        }
      });
      resolve(stream);
    });
  });
}
