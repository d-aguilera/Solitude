import type { ControlledBody, EntityId, World } from "../domain/domainPorts";
import type { ControlInput } from "./controlPorts";
import type { Scene } from "./scenePorts";

export type TickCallback = (
  output: Readonly<TickOutput>,
  params: Readonly<TickParams>,
) => void;

export interface TickParams {
  dtMillis: number;
  dtMillisSim: number;
  controlInput: ControlInput;
}

export interface TickOutput {
  currentThrustLevel: number;
  currentRcsLevel: number;
}

export interface FocusContext {
  entityId: EntityId;
  controlledBody: ControlledBody;
}

export interface WorldAndScene {
  mainFocus: FocusContext;
  mainControlledBody: ControlledBody;
  scene: Scene;
  world: World;
}
