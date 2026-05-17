import type {
  ControlInput,
  ControlledBodyState,
  MutableControlState,
} from "@solitude/engine/app/controlPorts";
import type { PluginCapabilityRegistry } from "@solitude/engine/app/pluginPorts";
import type { World } from "@solitude/engine/domain/domainPorts";

const spacecraftPropulsionResolverCapabilityId =
  "spacecraft.propulsionResolver.v1";
const spacecraftAutonomousControlCapabilityId =
  "spacecraft.autonomousControl.v1";

export interface SpacecraftThrustCommand {
  /** Signed main-engine thrust percent in [-1, 1]. */
  forward: number;
}

export interface SpacecraftRcsCommand {
  /** Signed RCS translation command in [-1, 1] along the controlled body's right axis. */
  right: number;
}

export interface SpacecraftPropulsionCommand {
  main: SpacecraftThrustCommand;
  rcs: SpacecraftRcsCommand;
}

export interface SpacecraftPropulsionCommandParams {
  dtMillis: number;
  controlledBody: ControlledBodyState;
  world: World;
  controlInput: ControlInput;
  manualPropulsion: SpacecraftPropulsionCommand;
  maxThrustAcceleration: number;
  maxRcsTranslationAcceleration: number;
}

export interface SpacecraftPropulsionResolver {
  resolvePropulsionCommand: (
    params: SpacecraftPropulsionCommandParams,
  ) => SpacecraftPropulsionCommand;
}

export interface SpacecraftAutonomousControl {
  hasAutonomousControl: (controlState: MutableControlState) => boolean;
  writeAutonomousControlInput: (
    controlInput: ControlInput,
    controlState: MutableControlState,
  ) => void;
}

export function getSpacecraftPropulsionResolvers(
  registry: PluginCapabilityRegistry,
): SpacecraftPropulsionResolver[] {
  return registry
    .getAll(spacecraftPropulsionResolverCapabilityId)
    .filter(isSpacecraftPropulsionResolver);
}

export function getSpacecraftAutonomousControls(
  registry: PluginCapabilityRegistry,
): SpacecraftAutonomousControl[] {
  return registry
    .getAll(spacecraftAutonomousControlCapabilityId)
    .filter(isSpacecraftAutonomousControl);
}

function isSpacecraftPropulsionResolver(
  value: unknown,
): value is SpacecraftPropulsionResolver {
  const candidate = value as Partial<SpacecraftPropulsionResolver> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.resolvePropulsionCommand === "function"
  );
}

function isSpacecraftAutonomousControl(
  value: unknown,
): value is SpacecraftAutonomousControl {
  const candidate = value as Partial<SpacecraftAutonomousControl> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.hasAutonomousControl === "function" &&
    typeof candidate.writeAutonomousControlInput === "function"
  );
}
