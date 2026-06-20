import type {
  ControlInput,
  ControlPlugin,
  MutableControlState,
  PluginCapabilityProvider,
} from "@solitude/engine/plugin";
import {
  getAutopilotAttitudeCommand,
  getAutopilotMode,
  resolveAutopilotPropulsionCommand,
  type AutopilotMode,
} from "./logic";
import {
  createSpacecraftPropulsionResolverProvider,
  type SpacecraftPropulsionResolver,
} from "./spacecraftPropulsion";

export function createControlPlugin(): ControlPlugin {
  return {
    updateControlState: ({ controlInput, controlState }) => {
      const mode = getAutopilotMode(controlInput);
      if (mode === "none") {
        delete controlState[autopilotModeStateKey];
      } else {
        controlState[autopilotModeStateKey] = mode;
      }
    },
    getAttitudeCommand: (params) =>
      getAutopilotAttitudeCommand(
        params.dtMillis,
        params.controlledBody,
        params.controlInput,
        params.world,
      ),
  };
}

const autopilotModeStateKey = "autopilot.mode.v2";
const spacecraftAutonomousControlCapabilityId =
  "spacecraft.autonomousControl.v1";

type StoredAutopilotMode = Exclude<AutopilotMode, "none">;

export function isStoredAutopilotMode(
  value: unknown,
): value is StoredAutopilotMode {
  return (
    value === "alignToVelocity" ||
    value === "alignToBody" ||
    value === "circleNow"
  );
}

interface SpacecraftAutonomousControl {
  hasAutonomousControl: (controlState: MutableControlState) => boolean;
  writeAutonomousControlInput: (
    controlInput: ControlInput,
    controlState: MutableControlState,
  ) => void;
}

export function createAutonomousControlProvider(): PluginCapabilityProvider {
  return {
    id: spacecraftAutonomousControlCapabilityId,
    value: createAutopilotAutonomousControl(),
  };
}

function createAutopilotAutonomousControl(): SpacecraftAutonomousControl {
  return {
    hasAutonomousControl: (controlState) =>
      isStoredAutopilotMode(controlState[autopilotModeStateKey]),
    writeAutonomousControlInput: (controlInput, controlState) => {
      clearAutopilotActions(controlInput);
      const mode = controlState[autopilotModeStateKey];
      if (isStoredAutopilotMode(mode)) {
        controlInput[mode] = true;
      }
    },
  };
}

function clearAutopilotActions(controlInput: ControlInput): void {
  controlInput.alignToVelocity = false;
  controlInput.alignToBody = false;
  controlInput.circleNow = false;
}

export function createPropulsionResolverProvider() {
  return createSpacecraftPropulsionResolverProvider(
    createImmediatePropulsionResolver(),
  );
}

function createImmediatePropulsionResolver(): SpacecraftPropulsionResolver {
  return {
    resolvePropulsionCommand: (params) =>
      resolveAutopilotPropulsionCommand(
        params.dtMillis,
        params.controlInput,
        params.controlledBody,
        params.world,
        params.manualPropulsion,
        params.maxThrustAcceleration,
        params.maxRcsTranslationAcceleration,
      ),
  };
}
