import type { ShipBody, World } from "../domain/domainPorts.js";
import type { ControlInput } from "./controlPorts.js";
import type {
  DomainCameraPose,
  PolylineSceneObject,
  Scene,
} from "./scenePorts.js";

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
  trajectoryList: Trajectory[];
  world: World;
}
