import { describe, expect, it } from "vitest";
import {
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

  it("enables local prediction by default", () => {
    expect(shouldUseLocalPrediction()).toBe(true);
    expect(shouldUseLocalPrediction({ prediction: "on" })).toBe(true);
  });

  it("can disable local prediction through runtime options", () => {
    expect(shouldUseLocalPrediction({ prediction: "off" })).toBe(false);
    expect(shouldUseLocalPrediction({ prediction: "false" })).toBe(false);
    expect(shouldUseLocalPrediction({ prediction: "0" })).toBe(false);
  });
});
