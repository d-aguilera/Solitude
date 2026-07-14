import { startSolitudeHttpServer } from "@solitude/server/http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createDefaultSolitudeHttpServerOptions } from "./serverOptions";
import { loadDefaultMultiplayerContentPluginSet } from "./serverPlugins";

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";
const staticAssetRootCandidate = resolve(process.env.DIST_DIR ?? "dist/client");
const staticAssetRoot = existsSync(staticAssetRootCandidate)
  ? staticAssetRootCandidate
  : undefined;

void main();

async function main(): Promise<void> {
  const contentPlugins = await loadDefaultMultiplayerContentPluginSet(
    process.env,
  );
  const server = await startSolitudeHttpServer({
    ...createDefaultSolitudeHttpServerOptions(contentPlugins),
    hostname,
    port,
    staticAssetRoot,
  });

  console.log(`Solitude server listening at ${server.url}`);
  if (staticAssetRoot) {
    console.log(`Serving built client from ${staticAssetRoot}`);
  }

  const shutdown = async () => {
    await server.close();
  };

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });

  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });
}
