import type { ControlledBody, EntityId, World } from "../domain/domainPorts";
import type { ControlInput, EntityControlInputs } from "./controlPorts";
import type { Scene } from "./scenePorts";

export type TickCallback = () => void;

export interface TickParams {
  dtMillis: number;
  dtMillisSim: number;
  controlInput: ControlInput;
  controlInputsByEntityId: EntityControlInputs;
}

export interface FocusContext {
  entityId: EntityId;
  controlledBody: ControlledBody;
}

export interface WorldAndScene {
  mainFocus: FocusContext;
  scene: Scene;
  world: World;
}
