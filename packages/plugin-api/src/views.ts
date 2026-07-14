import type { ExternalControlInput } from "./input";
import type { Vec3 } from "./math";
import type { ExternalWorldAndSceneConfig } from "./scene";
import type { ExternalFocusContext, ExternalLocalFrame } from "./world";

export type ExternalViewLayout =
  | { kind: "primary" }
  | {
      avoidHud?: boolean;
      horizontal: "left" | "right";
      kind: "pip";
      vertical: "top" | "bottom";
    };

export interface ExternalMainViewLookState {
  azimuth: number;
  elevation: number;
}

export interface ExternalViewFrameUpdateParams {
  frame: ExternalLocalFrame;
  mainFocus: ExternalFocusContext;
  mainViewLookState: ExternalMainViewLookState;
}

export interface ExternalViewDefinition {
  id: string;
  initialCameraOffset: Vec3;
  labelMode: "full" | "nameOnly";
  layout: ExternalViewLayout;
  title?: string;
  updateFrame: (params: ExternalViewFrameUpdateParams) => void;
}

export interface ExternalMainViewCameraRig {
  id: string;
  updateFrame: (params: ExternalViewFrameUpdateParams) => void;
}

export interface ExternalViewRegistry {
  addMainViewCameraRig: (rig: ExternalMainViewCameraRig) => void;
  addView: (view: ExternalViewDefinition) => void;
}

export interface ExternalViewRegistrationParams {
  config: ExternalWorldAndSceneConfig;
}

export interface ExternalViewPlugin {
  registerViews: (
    registry: ExternalViewRegistry,
    params: ExternalViewRegistrationParams,
  ) => void;
}

export interface ExternalSceneControlState {
  mainViewLookState: ExternalMainViewLookState;
}

export interface ExternalPrimaryViewState {
  cameraOffset: Vec3;
}

export interface ExternalViewControlSceneState {
  primaryView: ExternalPrimaryViewState;
}

export interface ExternalViewControlUpdateParams {
  controlInput: ExternalControlInput;
  dtMillis: number;
  mainFocus: ExternalFocusContext;
  sceneControlState: ExternalSceneControlState;
  sceneState: ExternalViewControlSceneState;
}

export interface ExternalViewControlPlugin {
  updateViewControls?: (params: ExternalViewControlUpdateParams) => void;
}
