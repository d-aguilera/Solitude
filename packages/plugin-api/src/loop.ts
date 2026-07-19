import type { ExternalControlInput } from "./input";
import type {
  ExternalEntityId,
  ExternalFocusContext,
  ExternalWorld,
} from "./world";

export interface ExternalFramePolicy {
  advancePresentation: boolean;
  advanceScene: boolean;
  advanceSim: boolean;
  simDtMillis?: number;
  tickDtMillis?: number;
}

export interface ExternalLoopState {
  framePolicy: ExternalFramePolicy;
}

export interface ExternalLoopUpdateParams {
  controlInput: ExternalControlInput;
  dtMillis: number;
  focusEntity: (id: ExternalEntityId) => void;
  mainFocus: ExternalFocusContext;
  nowMs: number;
  simTimeMillis?: number;
  state: ExternalLoopState;
  world?: ExternalWorld;
}

export interface ExternalLoopUpdateResult {
  framePolicy?: Partial<ExternalFramePolicy>;
}

export interface ExternalLoopPlugin {
  initLoop?: () => void;
  updateLoopState?: (
    params: ExternalLoopUpdateParams,
  ) => ExternalLoopUpdateResult | null;
  afterFrame?: (params: ExternalLoopUpdateParams) => void;
}
