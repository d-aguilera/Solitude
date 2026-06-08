import type { SolitudeHttpServerOptions } from "@solitude/server/http";
import {
  type SolitudeGameRunner,
  type SolitudeGameRunnerFactoryOptions,
  createSolitudeGameRunner,
} from "@solitude/server/runner";
import {
  DEFAULT_SOLITUDE_GAME_TICK_POLICY,
  createSolitudeGameTicker,
} from "@solitude/server/ticker";
import { createDefaultSolitudeInProcessTransport } from "./composition";

export function createDefaultSolitudeGameRunner({
  metrics,
  onSnapshot,
}: SolitudeGameRunnerFactoryOptions): SolitudeGameRunner {
  const transport = createDefaultSolitudeInProcessTransport();
  return createSolitudeGameRunner({
    ticker: createSolitudeGameTicker({
      metrics,
      onSnapshot,
      policy: DEFAULT_SOLITUDE_GAME_TICK_POLICY,
      transport,
    }),
    transport,
  });
}

export function createDefaultSolitudeHttpServerOptions(): SolitudeHttpServerOptions {
  return {
    createRunner: createDefaultSolitudeGameRunner,
    hostname: "127.0.0.1",
    port: 8787,
  };
}
