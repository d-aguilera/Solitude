import { DEFAULT_SOLITUDE_GAME_TICK_POLICY } from "@solitude/server/ticker";
import { describe, expect, it } from "vitest";
import {
  createDefaultSolitudeGameTickPolicy,
  createDefaultSolitudeRuntimeOptions,
} from "../serverOptions";

describe("multiplayer server options", () => {
  it("uses the default authoritative tick policy without a sim-rate override", () => {
    expect(createDefaultSolitudeGameTickPolicy({})).toBe(
      DEFAULT_SOLITUDE_GAME_TICK_POLICY,
    );
    expect(createDefaultSolitudeGameTickPolicy({ SOLITUDE_SIM_RATE: "" })).toBe(
      DEFAULT_SOLITUDE_GAME_TICK_POLICY,
    );
  });

  it("uses SOLITUDE_SIM_RATE as the authoritative server time scale", () => {
    expect(
      createDefaultSolitudeGameTickPolicy({ SOLITUDE_SIM_RATE: "32" }),
    ).toEqual({
      ...DEFAULT_SOLITUDE_GAME_TICK_POLICY,
      simulationMillisPerWallMillis: 32,
    });
    expect(
      createDefaultSolitudeGameTickPolicy({ SOLITUDE_SIM_RATE: "0.5" }),
    ).toEqual({
      ...DEFAULT_SOLITUDE_GAME_TICK_POLICY,
      simulationMillisPerWallMillis: 0.5,
    });
  });

  it("rejects invalid sim-rate overrides", () => {
    expect(() =>
      createDefaultSolitudeGameTickPolicy({ SOLITUDE_SIM_RATE: "0" }),
    ).toThrow("SOLITUDE_SIM_RATE must be a positive finite number");
    expect(() =>
      createDefaultSolitudeGameTickPolicy({ SOLITUDE_SIM_RATE: "-1" }),
    ).toThrow("SOLITUDE_SIM_RATE must be a positive finite number");
    expect(() =>
      createDefaultSolitudeGameTickPolicy({ SOLITUDE_SIM_RATE: "fast" }),
    ).toThrow("SOLITUDE_SIM_RATE must be a positive finite number");
  });

  it("uses SOLITUDE_ORBITAL_SPEED_MULTIPLIER as a startup universe option", () => {
    expect(createDefaultSolitudeRuntimeOptions({})).toEqual({});
    expect(
      createDefaultSolitudeRuntimeOptions({
        SOLITUDE_ORBITAL_SPEED_MULTIPLIER: "",
      }),
    ).toEqual({});
    expect(
      createDefaultSolitudeRuntimeOptions({
        SOLITUDE_ORBITAL_SPEED_MULTIPLIER: "8",
      }),
    ).toEqual({ orbitalSpeedMultiplier: "8" });
  });

  it("rejects invalid orbital speed multiplier overrides", () => {
    expect(() =>
      createDefaultSolitudeRuntimeOptions({
        SOLITUDE_ORBITAL_SPEED_MULTIPLIER: "0",
      }),
    ).toThrow(
      "SOLITUDE_ORBITAL_SPEED_MULTIPLIER must be a positive finite number",
    );
    expect(() =>
      createDefaultSolitudeRuntimeOptions({
        SOLITUDE_ORBITAL_SPEED_MULTIPLIER: "fast",
      }),
    ).toThrow(
      "SOLITUDE_ORBITAL_SPEED_MULTIPLIER must be a positive finite number",
    );
  });
});
