import type {
  ExternalPluginCapabilityProvider,
  ExternalPluginCapabilityRegistry,
} from "./capabilities";
import type { ExternalMutableControlState } from "./controls";
import type { ExternalControlInput } from "./input";
import type { ExternalControlledBody, ExternalWorld } from "./world";

export const spacecraftPropulsionResolverCapability =
  "spacecraft.propulsionResolver.v1";
export const spacecraftAutonomousControlCapability =
  "spacecraft.autonomousControl.v1";

export interface ExternalSpacecraftThrustCommand {
  forward: number;
}

export interface ExternalSpacecraftRcsCommand {
  right: number;
}

export interface ExternalSpacecraftPropulsionCommand {
  main: ExternalSpacecraftThrustCommand;
  rcs: ExternalSpacecraftRcsCommand;
}

export interface ExternalSpacecraftPropulsionCommandParams {
  controlInput: ExternalControlInput;
  controlledBody: ExternalControlledBody;
  dtMillis: number;
  manualPropulsion: ExternalSpacecraftPropulsionCommand;
  maxRcsTranslationAcceleration: number;
  maxThrustAcceleration: number;
  world: ExternalWorld;
}

export interface ExternalSpacecraftPropulsionResolver {
  resolvePropulsionCommand: (
    params: ExternalSpacecraftPropulsionCommandParams,
  ) => ExternalSpacecraftPropulsionCommand;
}

export interface ExternalSpacecraftAutonomousControl {
  hasAutonomousControl: (controlState: ExternalMutableControlState) => boolean;
  writeAutonomousControlInput: (
    controlInput: ExternalControlInput,
    controlState: ExternalMutableControlState,
  ) => void;
}

export function createSpacecraftPropulsionResolverProvider(
  value: ExternalSpacecraftPropulsionResolver,
): ExternalPluginCapabilityProvider {
  return {
    id: spacecraftPropulsionResolverCapability,
    value,
  };
}

export function createSpacecraftAutonomousControlProvider(
  value: ExternalSpacecraftAutonomousControl,
): ExternalPluginCapabilityProvider {
  return {
    id: spacecraftAutonomousControlCapability,
    value,
  };
}

export function getSpacecraftPropulsionResolvers(
  registry: ExternalPluginCapabilityRegistry,
): ExternalSpacecraftPropulsionResolver[] {
  return registry
    .getAll(spacecraftPropulsionResolverCapability)
    .filter(isSpacecraftPropulsionResolver);
}

export function getSpacecraftAutonomousControls(
  registry: ExternalPluginCapabilityRegistry,
): ExternalSpacecraftAutonomousControl[] {
  return registry
    .getAll(spacecraftAutonomousControlCapability)
    .filter(isSpacecraftAutonomousControl);
}

function isSpacecraftPropulsionResolver(
  value: unknown,
): value is ExternalSpacecraftPropulsionResolver {
  const candidate =
    value as Partial<ExternalSpacecraftPropulsionResolver> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.resolvePropulsionCommand === "function"
  );
}

function isSpacecraftAutonomousControl(
  value: unknown,
): value is ExternalSpacecraftAutonomousControl {
  const candidate =
    value as Partial<ExternalSpacecraftAutonomousControl> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.hasAutonomousControl === "function" &&
    typeof candidate.writeAutonomousControlInput === "function"
  );
}
