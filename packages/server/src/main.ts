import { access } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createDefaultSolitudeHttpServerOptions,
  startSolitudeHttpServer,
} from "./http";

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";
const staticAssetRoot = resolve(process.env.DIST_DIR ?? "dist/client");

void main();

async function main(): Promise<void> {
  try {
    await access(resolve(staticAssetRoot, "remote.html"));
  } catch {
    throw new Error(
      `Built remote client not found in ${staticAssetRoot}. Run npm run build:client first.`,
    );
  }

  const server = await startSolitudeHttpServer({
    ...createDefaultSolitudeHttpServerOptions(),
    hostname,
    port,
    staticAssetRoot,
  });

  console.log(`Solitude server listening at ${server.url}`);
  console.log(`Serving built remote client from ${staticAssetRoot}`);

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
