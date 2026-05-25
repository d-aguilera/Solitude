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
await vite.ws.close();

const server = await startSolitudeHttpServer({
  ...createDefaultSolitudeHttpServerOptions(),
  devAssetHandler: createViteAssetHandler(vite),
  hostname,
  port,
});

console.log(`Solitude server probe listening at ${server.url}`);
console.log("Open the URL in a browser, then create a game and step it.");

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

function createViteAssetHandler(vite) {
  return async (request, response) => {
    if (request.method !== "GET" || !request.url) return false;

    const result = await vite.transformRequest(request.url);
    if (result) {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(result.code);
      return true;
    }

    return new Promise((resolve, reject) => {
      const originalEnd = response.end;
      let settled = false;

      response.end = function (...args) {
        response.end = originalEnd;
        if (!settled) {
          settled = true;
          resolve(true);
        }
        return originalEnd.apply(this, args);
      };

      vite.middlewares(request, response, (error) => {
        response.end = originalEnd;
        if (settled) return;
        settled = true;
        if (error) {
          reject(error);
        } else {
          resolve(false);
        }
      });
    });
  };
}
