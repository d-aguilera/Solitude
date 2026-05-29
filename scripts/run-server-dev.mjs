#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer as createViteServer } from "vite";

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";
const clientRoot = resolve("packages/client");

const vite = await createViteServer({
  appType: "custom",
  logLevel: "error",
  root: clientRoot,
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
  devAssetHandler: createDevAssetHandler(vite, clientRoot),
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

function createDevAssetHandler(vite, root) {
  return async (request, response) => {
    if (request.method !== "GET") return false;
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    if (requestUrl.pathname === "/" || requestUrl.pathname === "/remote.html") {
      const filename =
        requestUrl.pathname === "/" ? "index.html" : "remote.html";
      const source = await readFile(resolve(root, filename), "utf8");
      const html = await vite.transformIndexHtml(requestUrl.pathname, source);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
      return true;
    }
    if (requestUrl.pathname === "/remote.css") {
      const css = await readFile(resolve(root, "remote.css"), "utf8");
      response.writeHead(200, { "content-type": "text/css; charset=utf-8" });
      response.end(css);
      return true;
    }

    return new Promise((resolveHandled) => {
      let handled = false;
      response.once("finish", () => {
        handled = true;
        resolveHandled(true);
      });
      vite.middlewares(request, response, () => {
        if (!handled) resolveHandled(false);
      });
    });
  };
}
