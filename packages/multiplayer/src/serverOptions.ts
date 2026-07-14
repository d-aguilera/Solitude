import type { RuntimeOptions } from "@solitude/engine/plugin";
import type { SolitudeHttpServerOptions } from "@solitude/server/http";
import {
  createSolitudeGameRunner,
  type SolitudeGameRunner,
  type SolitudeGameRunnerFactoryOptions,
} from "@solitude/server/runner";
import {
  DEFAULT_SOLITUDE_GAME_TICK_POLICY,
  createSolitudeGameTicker,
  type SolitudeGameTickPolicy,
} from "@solitude/server/ticker";
import {
  createDefaultSolitudeInProcessTransport,
  type DefaultMultiplayerContentPluginFactories,
} from "./composition";

export function createDefaultSolitudeHttpServerOptions(
  contentPlugins: DefaultMultiplayerContentPluginFactories,
): SolitudeHttpServerOptions {
  return {
    createRunner: (options) =>
      createDefaultSolitudeGameRunner(options, contentPlugins),
    hostname: "127.0.0.1",
    port: 8787,
  };
}

function createDefaultSolitudeGameRunner(
  { metrics, onSnapshot }: SolitudeGameRunnerFactoryOptions,
  contentPlugins: DefaultMultiplayerContentPluginFactories,
): SolitudeGameRunner {
  const runtimeConfig = createDefaultSolitudeRuntimeConfig(process.env);
  const transport = createDefaultSolitudeInProcessTransport(
    contentPlugins,
    runtimeConfig.runtimeOptions,
  );
  return createSolitudeGameRunner({
    ticker: createSolitudeGameTicker({
      metrics,
      onSnapshot,
      policy: runtimeConfig.tickPolicy,
      transport,
    }),
    transport,
  });
}

interface DefaultSolitudeRuntimeConfig {
  runtimeOptions: RuntimeOptions;
  tickPolicy: SolitudeGameTickPolicy;
}

const simRateEnvironmentVariable = "SOLITUDE_SIM_RATE";
const orbitalSpeedMultiplierEnvironmentVariable =
  "SOLITUDE_ORBITAL_SPEED_MULTIPLIER";
const orbitalSpeedMultiplierRuntimeOption = "orbitalSpeedMultiplier";

function createDefaultSolitudeRuntimeConfig(
  env: Readonly<Record<string, string | undefined>>,
): DefaultSolitudeRuntimeConfig {
  return {
    runtimeOptions: createDefaultSolitudeRuntimeOptions(env),
    tickPolicy: createDefaultSolitudeGameTickPolicy(env),
  };
}

function createDefaultSolitudeRuntimeOptions(
  env: Readonly<Record<string, string | undefined>>,
): RuntimeOptions {
  const rawMultiplier = env[orbitalSpeedMultiplierEnvironmentVariable];
  if (rawMultiplier === undefined || rawMultiplier.trim().length === 0) {
    return {};
  }

  const orbitalSpeedMultiplier = Number(rawMultiplier);
  if (!Number.isFinite(orbitalSpeedMultiplier) || orbitalSpeedMultiplier <= 0) {
    throw new Error(
      `${orbitalSpeedMultiplierEnvironmentVariable} must be a positive finite number`,
    );
  }

  return {
    [orbitalSpeedMultiplierRuntimeOption]: String(orbitalSpeedMultiplier),
  };
}

function createDefaultSolitudeGameTickPolicy(
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
