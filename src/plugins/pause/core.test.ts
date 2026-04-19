import { describe, expect, it } from "vitest";
import { createControlInput } from "../../app/controlPorts";
import type { LoopUpdateParams } from "../../app/pluginPorts";
import { createLoopPlugin } from "./core";

function createLoopUpdateParams(pauseToggle: boolean): LoopUpdateParams {
  const controlInput = createControlInput(["pauseToggle"]);
  controlInput.pauseToggle = pauseToggle;
  return {
    controlInput,
    dtMillis: 16,
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

describe("pause loop plugin", () => {
  it("reuses loop update results instead of allocating every frame", () => {
    const { loop } = createLoopPlugin();

    const runningA = loop.updateLoopState?.(createLoopUpdateParams(false));
    const runningB = loop.updateLoopState?.(createLoopUpdateParams(false));

    expect(runningB).toBe(runningA);
    expect(runningA?.framePolicy).toEqual({
      advanceSim: true,
      advanceScene: true,
      advanceHud: true,
    });

    const pausedA = loop.updateLoopState?.(createLoopUpdateParams(true));
    const pausedB = loop.updateLoopState?.(createLoopUpdateParams(true));

    expect(pausedB).toBe(pausedA);
    expect(pausedA).not.toBe(runningA);
    expect(pausedA?.framePolicy).toEqual({
      advanceSim: false,
      advanceScene: false,
      advanceHud: true,
    });
  });
});
