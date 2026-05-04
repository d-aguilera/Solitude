import type { ControlInput, ControlledBodyState } from "../../app/controlPorts";
import type { PluginCapabilityProvider } from "../../app/pluginPorts";
import type { World } from "../../domain/domainPorts";

const spacecraftPropulsionResolverCapabilityId =
  "spacecraft.propulsionResolver.v1";

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

export function createSpacecraftPropulsionResolverProvider(
  value: SpacecraftPropulsionResolver,
): PluginCapabilityProvider {
  return {
    id: spacecraftPropulsionResolverCapabilityId,
    value,
  };
}
