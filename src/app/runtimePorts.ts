import type { ControlledBody, World } from "../domain/domainPorts";
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

export interface WorldAndScene {
  mainControlledBody: ControlledBody;
  scene: Scene;
  world: World;
}
