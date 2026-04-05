import type { ShipBody, World } from "../domain/domainPorts.js";
import type {
  AttitudeCommand,
  ControlledBodyState,
  SimControlState,
} from "./appInternals.js";
import type {
  ControlAction,
  ControlInput,
  EnvAction,
  EnvInput,
} from "./controlPorts.js";
import type { PropulsionCommand } from "./controls.js";
import type { HudRenderParams } from "./hudPorts.js";

export interface KeyHandler {
  handleKeyDown: (
    action: ControlAction | EnvAction,
    isRepeat: boolean,
  ) => boolean;
  handleKeyUp: (action: ControlAction | EnvAction) => boolean;
}

export interface InputPlugin {
  actions?: ControlAction[];
  keyMap?: Record<string, ControlAction | EnvAction>;
  createKeyHandler?: (
    controlInput: ControlInput,
    envInput: EnvInput,
  ) => KeyHandler;
}

export interface ControlStateUpdateParams {
  controlInput: ControlInput;
  controlState: SimControlState;
}

export interface AttitudeCommandParams {
  dtMillis: number;
  ship: ControlledBodyState;
  controlInput: ControlInput;
  controlState: SimControlState;
  world: World;
}

export interface PropulsionCommandParams {
  dtMillis: number;
  ship: ControlledBodyState;
  world: World;
  controlInput: ControlInput;
  manualPropulsion: PropulsionCommand;
  maxThrustAcceleration: number;
  maxRcsTranslationAcceleration: number;
}

export interface ControlPlugin {
  updateControlState?: (params: ControlStateUpdateParams) => void;
  getAttitudeCommand?: (
    params: AttitudeCommandParams,
  ) => AttitudeCommand | null;
  resolvePropulsionCommand?: (
    params: PropulsionCommandParams,
  ) => PropulsionCommand;
}

export interface HudContext {
  nowMs: number;
  world: World;
  mainShip: ShipBody;
  controlInput: ControlInput;
}

export interface HudPlugin {
  updateHudParams?: (params: HudRenderParams, context: HudContext) => void;
}

export interface GamePlugin {
  id: string;
  input?: InputPlugin;
  controls?: ControlPlugin;
  hud?: HudPlugin;
}
