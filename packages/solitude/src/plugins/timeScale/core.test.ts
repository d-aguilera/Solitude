import { createControlInput } from "@solitude/engine/app/controlPorts";
import type { LoopUpdateParams } from "@solitude/engine/app/pluginPorts";
import { parameters } from "@solitude/engine/global/parameters";
import { describe, expect, it } from "vitest";
import { createLoopPlugin } from "./core";

const mainFocus: LoopUpdateParams["mainFocus"] = {
  controlledBody: {} as LoopUpdateParams["mainFocus"]["controlledBody"],
  entityId: "ship:test",
};

function createLoopUpdateParams(dtMillis: number): LoopUpdateParams {
  const controlInput = createControlInput([
    "decreaseTimeScale",
    "increaseTimeScale",
  ]);
  return {
    controlInput,
    dtMillis,
    mainFocus,
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
