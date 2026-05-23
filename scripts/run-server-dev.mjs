#!/usr/bin/env node

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
  await vite.ssrLoadModule("./packages/server/src/http.ts");
await vite.close();

const server = await startSolitudeHttpServer({
  ...createDefaultSolitudeHttpServerOptions(),
  hostname,
  port,
});

console.log(`Solitude server probe listening at ${server.url}`);
console.log("Open the URL in a browser, then create a game and step it.");

const shutdown = async () => {
  await server.close();
};

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
