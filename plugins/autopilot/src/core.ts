import type { ExternalPluginCapabilityProvider } from "@solitude/plugin-api/capabilities";
import type { ExternalControlPlugin } from "@solitude/plugin-api/controls";
import type { ExternalControlInput } from "@solitude/plugin-api/input";
import { EPS_SPEED_FINE, vec3 } from "@solitude/plugin-api/math";
import {
  createSpacecraftAutonomousControlProvider,
  createSpacecraftPropulsionResolverProvider,
  type ExternalSpacecraftAutonomousControl,
  type ExternalSpacecraftPropulsionResolver,
  type ExternalSpacecraftVelocityReference,
} from "@solitude/plugin-api/spacecraft";
import type { ExternalEntityMotionState } from "@solitude/plugin-api/world";
import {
  computeAlignToDirectionCommand,
  getAutopilotAttitudeCommand,
  getAutopilotMode,
  resolveAutopilotPropulsionCommand,
  type AutopilotMode,
} from "./logic";

export function createControlPlugin(
  references: readonly ExternalSpacecraftVelocityReference[],
): ExternalControlPlugin {
  const direction = vec3.zero();
  return {
    updateControlState: ({ controlInput, controlState }) => {
      const mode = getAutopilotMode(controlInput);
      if (mode === "none") {
        delete controlState[autopilotModeStateKey];
      } else {
        controlState[autopilotModeStateKey] = mode;
      }
    },
    getAttitudeCommand: (params) => {
      if (
        params.controlInput.alignToVelocity &&
        !params.controlInput.circleNow &&
        !params.controlInput.orbit &&
        !params.controlInput.alignToBody
      ) {
        let referenceId: string | null = null;
        for (const provider of references) {
          const requested = provider.getReferenceEntityId(
            params.controlledBody.id,
          );
          if (requested === null) continue;
          if (referenceId !== null)
            throw new Error("Conflicting spacecraft velocity references");
          referenceId = requested;
        }
        if (referenceId !== null) {
          let reference: ExternalEntityMotionState | undefined;
          for (const body of params.world.entityStates) {
            if (body.id === referenceId) {
              reference = body;
              break;
            }
          }
          if (!reference) return null;
          vec3.subInto(
            direction,
            params.controlledBody.velocity,
            reference.velocity,
          );
          const speed = vec3.length(direction);
          if (!Number.isFinite(speed) || speed <= EPS_SPEED_FINE) return null;
          vec3.scaleInto(direction, 1 / speed, direction);
          return computeAlignToDirectionCommand(
            params.dtMillis,
            params.controlledBody,
            direction,
          );
        }
      }
      return getAutopilotAttitudeCommand(
        params.dtMillis,
        params.controlledBody,
        params.controlInput,
        params.world,
      );
    },
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
