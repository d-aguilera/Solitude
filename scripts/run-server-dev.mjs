#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer as createViteServer } from "vite";

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";

const vite = await createViteServer({
  configFile: resolve("vite.client.config.ts"),
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
    const originalUrl = request.url;
    request.url = mapDevAssetUrl(originalUrl);

    try {
      if (isHtmlRequest(request.url)) {
        return await serveDevHtml(vite, request, response);
      }

      if (isCssRequest(request.url)) {
        return await serveDevCss(vite, request, response);
      }

      if (await serveViteMiddleware(vite, request, response)) {
        return true;
      }

      const result = await vite.transformRequest(request.url);
      if (result) {
        response.writeHead(200, { "content-type": "text/javascript" });
        response.end(result.code);
        return true;
      }

      return false;
    } finally {
      request.url = originalUrl;
    }
  };
}

function serveViteMiddleware(vite, request, response) {
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
}

async function serveDevHtml(vite, request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const filename = pathname.slice(1);
  if (filename !== "lobby.html" && filename !== "remote.html") return false;

  const source = await readFile(resolve(vite.config.root, filename), "utf8");
  const html = await vite.transformIndexHtml(pathname, source);
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
  return true;
}

async function serveDevCss(vite, request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const filename = pathname.slice(1);
  if (filename !== "remote.css") return false;

  response.writeHead(200, { "content-type": "text/css; charset=utf-8" });
  response.end(await readFile(resolve(vite.config.root, filename), "utf8"));
  return true;
}

function mapDevAssetUrl(url) {
  const requestUrl = new URL(url, "http://localhost");
  if (requestUrl.pathname !== "/") return url;
  requestUrl.pathname = "/lobby.html";
  return `${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`;
}

function isHtmlRequest(url) {
  const pathname = new URL(url, "http://localhost").pathname;
  return pathname.endsWith(".html");
}

function isCssRequest(url) {
  const pathname = new URL(url, "http://localhost").pathname;
  return pathname.endsWith(".css");
}
