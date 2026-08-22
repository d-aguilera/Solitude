import { describe, expect, it } from "vitest";
import {
  mergeModelRuntimeOptions,
  runtimeOptionsEqual,
  shouldUseLocalPrediction,
  shouldUseRemoteSnapshotInterpolation,
} from "../remoteClientRenderer";

describe("remote client renderer", () => {
  it("enables remote snapshot interpolation by default", () => {
    expect(shouldUseRemoteSnapshotInterpolation()).toBe(true);
    expect(shouldUseRemoteSnapshotInterpolation({ interpolation: "on" })).toBe(
      true,
    );
  });

  it("can disable remote snapshot interpolation through runtime options", () => {
    expect(shouldUseRemoteSnapshotInterpolation({ interpolation: "off" })).toBe(
      false,
    );
    expect(
      shouldUseRemoteSnapshotInterpolation({ interpolation: "false" }),
    ).toBe(false);
    expect(shouldUseRemoteSnapshotInterpolation({ interpolation: "0" })).toBe(
      false,
    );
  });

  it("disables local prediction by default", () => {
    expect(shouldUseLocalPrediction()).toBe(false);
  });

  it("can enable and disable local prediction through runtime options", () => {
    expect(shouldUseLocalPrediction({ prediction: "on" })).toBe(true);
    expect(shouldUseLocalPrediction({ prediction: "true" })).toBe(true);
    expect(shouldUseLocalPrediction({ prediction: "1" })).toBe(true);
    expect(shouldUseLocalPrediction({ prediction: "off" })).toBe(false);
    expect(shouldUseLocalPrediction({ prediction: "false" })).toBe(false);
    expect(shouldUseLocalPrediction({ prediction: "0" })).toBe(false);
  });

  it("lets model runtime options override browser runtime options", () => {
    expect(
      mergeModelRuntimeOptions(
        {
          interpolation: "off",
          orbitalSpeedMultiplier: "1",
        },
        {
          orbitalSpeedMultiplier: "32",
        },
      ),
    ).toEqual({
      interpolation: "off",
      orbitalSpeedMultiplier: "32",
    });
  });

  it("compares runtime option records independent of key order", () => {
    expect(
      runtimeOptionsEqual(
        { interpolation: "on", prediction: "off" },
        { prediction: "off", interpolation: "on" },
      ),
    ).toBe(true);
    expect(
      runtimeOptionsEqual({ interpolation: "on" }, { interpolation: "off" }),
    ).toBe(false);
    expect(
      runtimeOptionsEqual(
        { interpolation: "on" },
        { interpolation: "on", prediction: "off" },
      ),
    ).toBe(false);
  });
});
