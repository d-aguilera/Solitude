import {
  DEFAULT_SOLITUDE_GAME_TICK_POLICY,
  type SolitudeGameTickPolicy,
} from "@solitude/server/ticker";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultSolitudeHttpServerOptions } from "../serverOptions";

const capturedTickPolicies = vi.hoisted(
  () => [] as SolitudeGameTickPolicy[],
);

vi.mock("@solitude/server/ticker", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@solitude/server/ticker")>();
  return {
    ...actual,
    createSolitudeGameTicker: vi.fn(
      (options: Parameters<typeof actual.createSolitudeGameTicker>[0]) => {
        capturedTickPolicies.push(options.policy);
        return {
          getSimulationMillisPerWallMillis: () =>
            options.policy.simulationMillisPerWallMillis,
          isRunning: () => false,
          runGame: vi.fn(),
          setSimulationMillisPerWallMillis: vi.fn(),
          stopAll: vi.fn(),
          stopGame: vi.fn(),
        };
      },
    ),
  };
});

const solitudeEnvironmentKeys = [
  "SOLITUDE_ORBITAL_SPEED_MULTIPLIER",
  "SOLITUDE_SIM_RATE",
] as const;

describe("multiplayer server options", () => {
  afterEach(() => {
    capturedTickPolicies.length = 0;
  });

  it("uses the default authoritative tick policy without a sim-rate override", () => {
    createRunnerWithEnvironment({});
    expect(capturedTickPolicies[0]).toBe(DEFAULT_SOLITUDE_GAME_TICK_POLICY);

    capturedTickPolicies.length = 0;

    createRunnerWithEnvironment({ SOLITUDE_SIM_RATE: "" });
    expect(capturedTickPolicies[0]).toBe(DEFAULT_SOLITUDE_GAME_TICK_POLICY);
  });

  it("uses SOLITUDE_SIM_RATE as the authoritative server time scale", () => {
    createRunnerWithEnvironment({ SOLITUDE_SIM_RATE: "32" });
    expect(capturedTickPolicies[0]).toEqual({
      ...DEFAULT_SOLITUDE_GAME_TICK_POLICY,
      simulationMillisPerWallMillis: 32,
    });

    capturedTickPolicies.length = 0;

    createRunnerWithEnvironment({ SOLITUDE_SIM_RATE: "0.5" });
    expect(capturedTickPolicies[0]).toEqual({
      ...DEFAULT_SOLITUDE_GAME_TICK_POLICY,
      simulationMillisPerWallMillis: 0.5,
    });
  });

  it("rejects invalid sim-rate overrides", () => {
    expect(() =>
      createRunnerWithEnvironment({ SOLITUDE_SIM_RATE: "0" }),
    ).toThrow("SOLITUDE_SIM_RATE must be a positive finite number");
    expect(() =>
      createRunnerWithEnvironment({ SOLITUDE_SIM_RATE: "-1" }),
    ).toThrow("SOLITUDE_SIM_RATE must be a positive finite number");
    expect(() =>
      createRunnerWithEnvironment({ SOLITUDE_SIM_RATE: "fast" }),
    ).toThrow("SOLITUDE_SIM_RATE must be a positive finite number");
  });

  it("sends SOLITUDE_ORBITAL_SPEED_MULTIPLIER as a startup universe option", () => {
    expect(createGameModelWithEnvironment({}).runtimeOptions).toEqual({});
    expect(
      createGameModelWithEnvironment({
        SOLITUDE_ORBITAL_SPEED_MULTIPLIER: "",
      }).runtimeOptions,
    ).toEqual({});
    expect(
      createGameModelWithEnvironment({
        SOLITUDE_ORBITAL_SPEED_MULTIPLIER: "8",
      }).runtimeOptions,
    ).toEqual({ orbitalSpeedMultiplier: "8" });
  });

  it("rejects invalid orbital speed multiplier overrides", () => {
    expect(() =>
      createRunnerWithEnvironment({
        SOLITUDE_ORBITAL_SPEED_MULTIPLIER: "0",
      }),
    ).toThrow(
      "SOLITUDE_ORBITAL_SPEED_MULTIPLIER must be a positive finite number",
    );
    expect(() =>
      createRunnerWithEnvironment({
        SOLITUDE_ORBITAL_SPEED_MULTIPLIER: "fast",
      }),
    ).toThrow(
      "SOLITUDE_ORBITAL_SPEED_MULTIPLIER must be a positive finite number",
    );
  });
});

function createGameModelWithEnvironment(env: Readonly<Record<string, string>>) {
  const runner = createRunnerWithEnvironment(env);
  runner.receive({
    type: "createGame",
    clientId: "client:a",
    sequence: 1,
  }, 1);
  const messages = runner.receive({
    type: "joinGame",
    clientId: "client:a",
    gameId: "game:1",
    sequence: 2,
  }, 2);
  const model = messages.find((message) => message.type === "gameModel");
  if (!model || model.type !== "gameModel") {
    throw new Error("Missing game model message");
  }
  return model;
}

function createRunnerWithEnvironment(env: Readonly<Record<string, string>>) {
  return withSolitudeEnvironment(env, () =>
    createDefaultSolitudeHttpServerOptions().createRunner({
      metrics: createNoopMetrics(),
      onSnapshot: () => {},
    }),
  );
}

type RunnerFactoryOptions = Parameters<
  ReturnType<typeof createDefaultSolitudeHttpServerOptions>["createRunner"]
>[0];

function withSolitudeEnvironment<T>(
  env: Readonly<Record<string, string>>,
  callback: () => T,
): T {
  const previousValues = new Map(
    solitudeEnvironmentKeys.map((key) => [key, process.env[key]]),
  );
  try {
    for (const key of solitudeEnvironmentKeys) {
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(env)) {
      process.env[key] = value;
    }
    return callback();
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function createNoopMetrics(): RunnerFactoryOptions["metrics"] {
  return {
    createReport: () => ({
      games: [],
      process: {
        heapUsedBytes: 0,
        rssBytes: 0,
      },
      sockets: {
        connected: 0,
      },
      windowMillis: 0,
    }),
    recordSnapshotBroadcast: () => {},
    recordSnapshotStep: () => {},
  };
}
