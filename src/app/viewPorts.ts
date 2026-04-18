import type { ShipBody } from "../domain/domainPorts";
import type { LocalFrame } from "../domain/localFrame";
import type { Vec3 } from "../domain/vec3";
import type { DomainCameraPose, PilotLookState } from "./scenePorts";

export type SceneViewId = string;

export type ViewLabelMode = "full" | "nameOnly";

export type ViewLayout =
  | {
      kind: "primary";
    }
  | {
      kind: "pip";
      horizontal: "left" | "right";
      vertical: "top" | "bottom";
      avoidHud?: boolean;
    };

export interface ViewFrameUpdateParams {
  frame: LocalFrame;
  mainShip: ShipBody;
  pilotLookState: PilotLookState;
}

export interface ViewDefinition {
  id: SceneViewId;
  labelMode: ViewLabelMode;
  initialCameraOffset: Vec3;
  layout: ViewLayout;
  updateFrame: (params: ViewFrameUpdateParams) => void;
}

export interface SceneViewState {
  definition: ViewDefinition;
  camera: DomainCameraPose;
  cameraOffset: Vec3;
}
