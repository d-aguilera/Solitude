import type { ControlInput } from "@solitude/engine/plugin";
import type { EntityId } from "@solitude/engine/world";
import type { SolitudeInputSequence } from "@solitude/protocol/protocol";

export interface LocalInputPrediction {
  readonly controls: Partial<ControlInput>;
  readonly inputSequence: SolitudeInputSequence;
}

export interface LocalPredictionState {
  readonly pendingInputs: LocalInputPrediction[];
  controlInput: ControlInput;
}

export function createLocalPredictionState(): LocalPredictionState {
  return {
    pendingInputs: [],
    controlInput: {},
  };
}

export function recordLocalInput(
  state: LocalPredictionState,
  controls: Partial<ControlInput>,
  inputSequence: SolitudeInputSequence,
): void {
  applyControlPatch(state.controlInput, controls);
  state.pendingInputs.push({
    controls: { ...controls },
    inputSequence,
  });
}

export function acknowledgeLocalInputs(
  state: LocalPredictionState,
  entityId: EntityId,
  lastProcessedInputSequences: Readonly<
    Record<EntityId, SolitudeInputSequence>
  >,
): void {
  const acknowledgedSequence = lastProcessedInputSequences[entityId];
  if (acknowledgedSequence === undefined) return;

  let firstPendingIndex = 0;
  while (
    firstPendingIndex < state.pendingInputs.length &&
    state.pendingInputs[firstPendingIndex].inputSequence <= acknowledgedSequence
  ) {
    firstPendingIndex++;
  }
  if (firstPendingIndex === 0) return;
  state.pendingInputs.splice(0, firstPendingIndex);
}

export function hasActiveLocalPrediction(state: LocalPredictionState): boolean {
  if (state.pendingInputs.length > 0) return true;
  for (const value of Object.values(state.controlInput)) {
    if (value) return true;
  }
  return false;
}

function applyControlPatch(
  controlInput: ControlInput,
  controls: Partial<ControlInput>,
): void {
  for (const [action, value] of Object.entries(controls)) {
    if (value !== undefined) controlInput[action] = value;
  }
}
