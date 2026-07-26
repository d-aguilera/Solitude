import type { ExternalControlInput } from "./input";
import type { ExternalControlledBody, ExternalWorld } from "./world";

export type ExternalMutableControlState = Record<string, unknown>;

export interface ExternalAttitudeCommand {
  pitch: number;
  roll: number;
  yaw: number;
}

export interface ExternalAttitudeCommandParams {
  controlInput: ExternalControlInput;
  controlledBody: ExternalControlledBody;
  controlState: ExternalMutableControlState;
  dtMillis: number;
  world: ExternalWorld;
}

export interface ExternalControlStateUpdateParams {
  controlInput: ExternalControlInput;
  controlState: ExternalMutableControlState;
}

export interface ExternalControlPlugin {
  getAttitudeCommand?: (
    params: ExternalAttitudeCommandParams,
  ) => ExternalAttitudeCommand | null;
  updateControlState?: (params: ExternalControlStateUpdateParams) => void;
}
