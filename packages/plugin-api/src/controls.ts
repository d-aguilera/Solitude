import type { ExternalControlInput } from "./input";

export type ExternalMutableControlState = Record<string, unknown>;

export interface ExternalControlStateUpdateParams {
  controlInput: ExternalControlInput;
  controlState: ExternalMutableControlState;
}

export interface ExternalControlPlugin {
  updateControlState?: (params: ExternalControlStateUpdateParams) => void;
}
