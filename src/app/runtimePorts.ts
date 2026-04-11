import type { ShipBody, World } from "../domain/domainPorts";
import type { ControlInput } from "./controlPorts";
import type {
  DomainCameraPose,
  PolylineSceneObject,
  Scene,
} from "./scenePorts";

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

export type Trajectory = {
  intervalMillis: number;
  remainingMillis: number;
  sceneObject: PolylineSceneObject;
};

export interface WorldAndScene {
  enemyShip: ShipBody;
  mainShip: ShipBody;
  pilotCamera: DomainCameraPose;
  scene: Scene;
  topCamera: DomainCameraPose;
  world: World;
}
