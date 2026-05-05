import type { ControlAction } from "../../app/controlPorts";
import type { AngularVelocity } from "../../domain/domainPorts";
import type { LocalFrame } from "../../domain/localFrame";
import type { Mat3 } from "../../domain/mat3";
import type { Vec3 } from "../../domain/vec3";

export type PlaybackScenarioId = string;
export type PlaybackEndBehavior = "pause";
export type PlaybackStatus =
  | "inactive"
  | "capture-idle"
  | "capture-recording"
  | "waiting"
  | "playing"
  | "paused"
  | "done"
  | "missing"
  | "released"
  | "warning";

export interface PlaybackScript {
  id: PlaybackScenarioId;
  snapshot: PlaybackSnapshot;
  fixedDtMillis: number;
  timeScale: number;
  phases: PlaybackPhase[];
  endBehavior: PlaybackEndBehavior;
  metadata: PlaybackScriptMetadata;
}

export interface PlaybackPhase {
  durationMs: number;
  controls: PlaybackControlState;
}

export interface PlaybackScriptMetadata {
  capturedSimTimeMillis: number;
  recordingStartedRuntimeMs: number;
  recordingEndedRuntimeMs: number;
}

export interface PlaybackControlState {
  thrustLevel?: ThrustLevel;
  burnForward?: boolean;
  burnBackwards?: boolean;
  burnLeft?: boolean;
  burnRight?: boolean;
  rollLeft?: boolean;
  rollRight?: boolean;
  pitchUp?: boolean;
  pitchDown?: boolean;
  yawLeft?: boolean;
  yawRight?: boolean;
  alignToVelocity?: boolean;
  alignToBody?: boolean;
  circleNow?: boolean;
}

export type ThrustLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface CompiledPlaybackPhase {
  endMs: number;
  trueActions: readonly ControlAction[];
  thrustLevel: ThrustLevel | null;
}

export interface CompiledPlaybackScript {
  id: PlaybackScenarioId;
  snapshot: PlaybackSnapshot;
  fixedDtMillis: number;
  timeScale: number;
  phases: readonly CompiledPlaybackPhase[];
  totalDurationMs: number;
  endBehavior: PlaybackEndBehavior;
  metadata: PlaybackScriptMetadata;
}

export interface PlaybackSnapshot {
  entities: PlaybackEntitySnapshot[];
  metadata: PlaybackSnapshotMetadata;
}

export interface PlaybackSnapshotMetadata {
  label: PlaybackScenarioId;
  capturedSimTimeMillis: number;
  dominantBodyId: string | null;
  focusEntityId: string;
}

export interface PlaybackEntitySnapshot {
  id: string;
  position: Vec3;
  velocity: Vec3;
  orientation: Mat3;
  angularVelocity?: AngularVelocity;
  frame?: LocalFrame;
}
