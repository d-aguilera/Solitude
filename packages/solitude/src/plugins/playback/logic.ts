import type {
  ControlAction,
  ControlInput,
} from "@solitude/engine/app/controlPorts";
import type {
  CompiledPlaybackPhase,
  CompiledPlaybackScript,
  PlaybackControlState,
  PlaybackScript,
  ThrustLevel,
} from "./types";

type PlaybackBooleanControlKey = Exclude<
  keyof PlaybackControlState,
  "thrustLevel"
>;

export const playbackOwnedActions: readonly PlaybackBooleanControlKey[] = [
  "burnForward",
  "burnBackwards",
  "burnLeft",
  "burnRight",
  "rollLeft",
  "rollRight",
  "pitchUp",
  "pitchDown",
  "yawLeft",
  "yawRight",
  "alignToVelocity",
  "alignToBody",
  "circleNow",
];

export function compilePlaybackScript(
  script: PlaybackScript,
): CompiledPlaybackScript {
  const phases: CompiledPlaybackPhase[] = [];
  let endMs = 0;

  for (const phase of script.phases) {
    const durationMs = Math.max(0, phase.durationMs);
    if (durationMs === 0) continue;
    endMs += durationMs;
    phases.push({
      endMs,
      trueActions: collectTrueActions(phase.controls),
      thrustLevel: phase.controls.thrustLevel ?? null,
    });
  }

  return {
    id: script.id,
    snapshot: script.snapshot,
    fixedDtMillis: script.fixedDtMillis,
    timeScale: script.timeScale,
    phases,
    totalDurationMs: endMs,
    endBehavior: script.endBehavior,
    metadata: script.metadata,
  };
}

export function applyCompiledPhaseControls(
  controlInput: ControlInput,
  phase: CompiledPlaybackPhase | null,
): void {
  clearPlaybackControls(controlInput);
  if (!phase) return;

  const actions = phase.trueActions;
  for (let i = 0; i < actions.length; i++) {
    controlInput[actions[i]] = true;
  }
}

export function clearPlaybackControls(controlInput: ControlInput): void {
  for (let i = 0; i < playbackOwnedActions.length; i++) {
    controlInput[playbackOwnedActions[i]] = false;
  }
}

export function readPlaybackControlState(
  controlInput: ControlInput,
  thrustLevel: number | null,
): PlaybackControlState {
  const state: PlaybackControlState = {};

  for (let i = 0; i < playbackOwnedActions.length; i++) {
    const action = playbackOwnedActions[i];
    if (controlInput[action]) {
      state[action] = true;
    }
  }

  if (isThrustLevel(thrustLevel)) {
    state.thrustLevel = thrustLevel;
  }

  return state;
}

export function playbackControlsEqual(
  a: PlaybackControlState,
  b: PlaybackControlState,
): boolean {
  if ((a.thrustLevel ?? null) !== (b.thrustLevel ?? null)) return false;
  for (let i = 0; i < playbackOwnedActions.length; i++) {
    const action = playbackOwnedActions[i];
    if ((a[action] ?? false) !== (b[action] ?? false)) return false;
  }
  return true;
}

export function clonePlaybackControlState(
  state: PlaybackControlState,
): PlaybackControlState {
  const clone: PlaybackControlState = {};
  if (state.thrustLevel !== undefined) clone.thrustLevel = state.thrustLevel;
  for (let i = 0; i < playbackOwnedActions.length; i++) {
    const action = playbackOwnedActions[i];
    if (state[action]) {
      clone[action] = true;
    }
  }
  return clone;
}

export function phaseForScriptTime(
  script: CompiledPlaybackScript,
  scriptTimeMs: number,
  currentPhaseIndex: number,
): number {
  const phases = script.phases;
  let index = currentPhaseIndex;
  while (index + 1 < phases.length && scriptTimeMs >= phases[index].endMs) {
    index++;
  }
  return index;
}

function collectTrueActions(
  controls: PlaybackControlState,
): readonly ControlAction[] {
  const actions: ControlAction[] = [];
  for (let i = 0; i < playbackOwnedActions.length; i++) {
    const action = playbackOwnedActions[i];
    if (controls[action]) {
      actions.push(action);
    }
  }
  return actions;
}

function isThrustLevel(value: number | null): value is ThrustLevel {
  return (
    value === 0 ||
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6 ||
    value === 7 ||
    value === 8 ||
    value === 9
  );
}
