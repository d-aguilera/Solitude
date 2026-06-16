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

const simRateEnvironmentVariable = "SOLITUDE_SIM_RATE";

export function createDefaultSolitudeGameRunner({
  metrics,
  onSnapshot,
}: SolitudeGameRunnerFactoryOptions): SolitudeGameRunner {
  const transport = createDefaultSolitudeInProcessTransport();
  return createSolitudeGameRunner({
    ticker: createSolitudeGameTicker({
      metrics,
      onSnapshot,
      policy: createDefaultSolitudeGameTickPolicy(process.env),
      transport,
    }),
    transport,
  });
}

export function createDefaultSolitudeGameTickPolicy(
  env: Readonly<Record<string, string | undefined>>,
) {
  const rawSimRate = env[simRateEnvironmentVariable];
  if (rawSimRate === undefined || rawSimRate.trim().length === 0) {
    return DEFAULT_SOLITUDE_GAME_TICK_POLICY;
  }

  const simulationMillisPerWallMillis = Number(rawSimRate);
  if (
    !Number.isFinite(simulationMillisPerWallMillis) ||
    simulationMillisPerWallMillis <= 0
  ) {
    throw new Error(
      `${simRateEnvironmentVariable} must be a positive finite number`,
    );
  }

  return {
    ...DEFAULT_SOLITUDE_GAME_TICK_POLICY,
    simulationMillisPerWallMillis,
  };
}

export function createDefaultSolitudeHttpServerOptions(): SolitudeHttpServerOptions {
  return {
    createRunner: createDefaultSolitudeGameRunner,
    hostname: "127.0.0.1",
    port: 8787,
  };
}
