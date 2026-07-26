export {
  createSpacecraftAutonomousControlProvider,
  createSpacecraftPropulsionResolverProvider,
  spacecraftAutonomousControlCapability,
  spacecraftPropulsionResolverCapability,
} from "@solitude/spacecraft/capabilities";
export type {
  SpacecraftAutonomousControl as ExternalSpacecraftAutonomousControl,
  SpacecraftPropulsionCommand as ExternalSpacecraftPropulsionCommand,
  SpacecraftPropulsionCommandParams as ExternalSpacecraftPropulsionCommandParams,
  SpacecraftPropulsionResolver as ExternalSpacecraftPropulsionResolver,
  SpacecraftRcsCommand as ExternalSpacecraftRcsCommand,
  SpacecraftThrustCommand as ExternalSpacecraftThrustCommand,
} from "@solitude/spacecraft/capabilities";
