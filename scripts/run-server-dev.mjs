#!/usr/bin/env node

import { resolve } from "node:path";
import { createServer as createViteServer } from "vite";

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";

const vite = await createViteServer({
  appType: "custom",
  logLevel: "error",
  server: {
    hmr: false,
    middlewareMode: true,
  },
});

const { createDefaultSolitudeHttpServerOptions, startSolitudeHttpServer } =
  await vite.ssrLoadModule(resolve("packages/server/src/http.ts"));
await vite.ws.close();

const server = await startSolitudeHttpServer({
  ...createDefaultSolitudeHttpServerOptions(),
  hostname,
  port,
});

console.log(`Solitude server listening at ${server.url}`);

const shutdown = async () => {
  await server.close();
  await vite.close();
};

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
