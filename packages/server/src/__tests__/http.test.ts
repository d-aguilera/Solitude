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
      expect(page).toContain("Solitude Server Probe");
      expect(page).toContain("position.x");
      expect(page).not.toContain("position[0]");
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
