import type { ControlledBody } from "../domain/domainPorts";
import type { LocalFrame } from "../domain/localFrame";
import type { Vec3 } from "../domain/vec3";
import type { FocusContext } from "./runtimePorts";
import type { DomainCameraPose, MainViewLookState } from "./scenePorts";

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
  mainFocus: FocusContext;
  /** @deprecated Use mainFocus. */
  mainControlledBody?: ControlledBody;
  mainViewLookState: MainViewLookState;
  /** @deprecated Use mainViewLookState. */
  pilotLookState?: MainViewLookState;
}

export interface ViewDefinition {
  id: SceneViewId;
  labelMode: ViewLabelMode;
  initialCameraOffset: Vec3;
  layout: ViewLayout;
  updateFrame: (params: ViewFrameUpdateParams) => void;
}

export interface SceneState {
  primaryView: SceneViewState;
  views: SceneViewState[];
}

export interface SceneViewState {
  definition: ViewDefinition;
  camera: DomainCameraPose;
  cameraOffset: Vec3;
}
