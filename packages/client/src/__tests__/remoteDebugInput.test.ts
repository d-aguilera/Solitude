import { describe, expect, it } from "vitest";
import { getRemoteDebugAction } from "../remoteDebugInput";

describe("remote debug input", () => {
  it("reserves only shifted I for interpolation diagnostics", () => {
    expect(getRemoteDebugAction({ code: "KeyI", shiftKey: false })).toBeNull();
    expect(getRemoteDebugAction({ code: "KeyI", shiftKey: true })).toBe(
      "interpolation",
    );
  });

  it("preserves the other remote debug bindings", () => {
    expect(getRemoteDebugAction({ code: "KeyP", shiftKey: false })).toBe(
      "prediction",
    );
    expect(getRemoteDebugAction({ code: "BracketLeft", shiftKey: false })).toBe(
      "decreaseSimulationRate",
    );
    expect(
      getRemoteDebugAction({ code: "BracketRight", shiftKey: false }),
    ).toBe("increaseSimulationRate");
  });
});
