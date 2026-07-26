import type {
  ControlInput,
  ControlledBodyState,
  MutableControlState,
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
} from "@solitude/engine/plugin";
import type { World } from "@solitude/engine/world";

export const spacecraftPropulsionResolverCapability =
  "spacecraft.propulsionResolver.v1";
export const spacecraftAutonomousControlCapability =
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
  controlInput: ControlInput;
  controlledBody: ControlledBodyState;
  dtMillis: number;
  manualPropulsion: SpacecraftPropulsionCommand;
  maxRcsTranslationAcceleration: number;
  maxThrustAcceleration: number;
  world: World;
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

export function createSpacecraftPropulsionResolverProvider(
  value: SpacecraftPropulsionResolver,
): PluginCapabilityProvider {
  return {
    id: spacecraftPropulsionResolverCapability,
    value,
  };
}

export function createSpacecraftAutonomousControlProvider(
  value: SpacecraftAutonomousControl,
): PluginCapabilityProvider {
  return {
    id: spacecraftAutonomousControlCapability,
    value,
  };
}

export function getSpacecraftPropulsionResolvers(
  registry: PluginCapabilityRegistry,
): SpacecraftPropulsionResolver[] {
  return registry
    .getAll(spacecraftPropulsionResolverCapability)
    .filter(isSpacecraftPropulsionResolver);
}

export function getSpacecraftAutonomousControls(
  registry: PluginCapabilityRegistry,
): SpacecraftAutonomousControl[] {
  return registry
    .getAll(spacecraftAutonomousControlCapability)
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
