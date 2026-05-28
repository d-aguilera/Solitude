import { resolve } from "node:path";
import {
  createDefaultSolitudeHttpServerOptions,
  startSolitudeHttpServer,
} from "./http";

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";
const staticAssetRoot = process.env.DIST_DIR
  ? resolve(process.env.DIST_DIR)
  : undefined;

void main();

async function main(): Promise<void> {
  const server = await startSolitudeHttpServer({
    ...createDefaultSolitudeHttpServerOptions(),
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
