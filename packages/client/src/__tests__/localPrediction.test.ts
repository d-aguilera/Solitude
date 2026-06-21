import { describe, expect, it } from "vitest";
import {
  acknowledgeLocalInputs,
  createLocalPredictionState,
  hasActiveLocalPrediction,
  recordLocalInput,
} from "../localPrediction";

describe("local prediction state", () => {
  it("tracks pending input sequences until authoritative snapshots acknowledge them", () => {
    const state = createLocalPredictionState();

    recordLocalInput(state, { yawLeft: true }, 1);
    recordLocalInput(state, { yawLeft: false }, 2);

    expect(state.controlInput.yawLeft).toBe(false);
    expect(state.pendingInputs.map((input) => input.inputSequence)).toEqual([
      1, 2,
    ]);
    expect(hasActiveLocalPrediction(state)).toBe(true);

    acknowledgeLocalInputs(state, "ship:1", { "ship:1": 1 });

    expect(state.pendingInputs.map((input) => input.inputSequence)).toEqual([
      2,
    ]);
    expect(hasActiveLocalPrediction(state)).toBe(true);

    acknowledgeLocalInputs(state, "ship:1", { "ship:1": 2 });

    expect(state.pendingInputs).toHaveLength(0);
    expect(hasActiveLocalPrediction(state)).toBe(false);
  });

  it("keeps prediction active while local controls are held after acknowledgement", () => {
    const state = createLocalPredictionState();

    recordLocalInput(state, { burnForward: true }, 1);
    acknowledgeLocalInputs(state, "ship:1", { "ship:1": 1 });

    expect(state.pendingInputs).toHaveLength(0);
    expect(hasActiveLocalPrediction(state)).toBe(true);
  });
});
