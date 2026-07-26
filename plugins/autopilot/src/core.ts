import type { ExternalPluginCapabilityProvider } from "@solitude/plugin-api/capabilities";
import type { ExternalControlPlugin } from "@solitude/plugin-api/controls";
import type { ExternalControlInput } from "@solitude/plugin-api/input";
import {
  createSpacecraftAutonomousControlProvider,
  createSpacecraftPropulsionResolverProvider,
  type ExternalSpacecraftAutonomousControl,
  type ExternalSpacecraftPropulsionResolver,
} from "@solitude/plugin-api/spacecraft";
import {
  getAutopilotAttitudeCommand,
  getAutopilotMode,
  resolveAutopilotPropulsionCommand,
  type AutopilotMode,
} from "./logic";

export function createControlPlugin(): ExternalControlPlugin {
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

type StoredAutopilotMode = Exclude<AutopilotMode, "none">;

export function isStoredAutopilotMode(
  value: unknown,
): value is StoredAutopilotMode {
  return (
    value === "alignToVelocity" ||
    value === "alignToBody" ||
    value === "orbit" ||
    value === "circleNow"
  );
}

export function createAutonomousControlProvider(): ExternalPluginCapabilityProvider {
  return createSpacecraftAutonomousControlProvider(
    createAutopilotAutonomousControl(),
  );
}

function createAutopilotAutonomousControl(): ExternalSpacecraftAutonomousControl {
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

function clearAutopilotActions(controlInput: ExternalControlInput): void {
  controlInput.alignToVelocity = false;
  controlInput.alignToBody = false;
  controlInput.orbit = false;
  controlInput.circleNow = false;
}

export function createPropulsionResolverProvider() {
  return createSpacecraftPropulsionResolverProvider(
    createImmediatePropulsionResolver(),
  );
}

function createImmediatePropulsionResolver(): ExternalSpacecraftPropulsionResolver {
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
