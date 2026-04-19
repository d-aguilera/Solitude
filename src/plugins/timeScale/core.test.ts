import { describe, expect, it } from "vitest";
import { createControlInput } from "../../app/controlPorts";
import type { LoopUpdateParams } from "../../app/pluginPorts";
import { parameters } from "../../global/parameters";
import { createLoopPlugin } from "./core";

function createLoopUpdateParams(dtMillis: number): LoopUpdateParams {
  const controlInput = createControlInput([
    "decreaseTimeScale",
    "increaseTimeScale",
  ]);
  return {
    controlInput,
    dtMillis,
    nowMs: 0,
    state: {
      framePolicy: {
        advanceSim: true,
        advanceScene: true,
        advanceHud: true,
      },
    },
  };
}

describe("time scale loop plugin", () => {
  it("reuses its loop update result instead of allocating every frame", () => {
    const { plugin } = createLoopPlugin();
    const params = createLoopUpdateParams(16);

    const first = plugin.updateLoopState?.(params);
    params.dtMillis = 32;
    const second = plugin.updateLoopState?.(params);

    expect(second).toBe(first);
    expect(second?.framePolicy).toBe(first?.framePolicy);
    expect(second?.framePolicy?.simDtMillis).toBe(32 * parameters.timeScale);
  });
});
