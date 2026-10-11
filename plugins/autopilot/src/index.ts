import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import {
  getSpacecraftVelocityReferences,
  type ExternalSpacecraftVelocityReference,
} from "@solitude/plugin-api/spacecraft";
import {
  createAutonomousControlProvider,
  createControlPlugin,
  createPropulsionResolverProvider,
} from "./core";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions = {},
): ExternalPlugin {
  void runtimeOptions;
  const references: ExternalSpacecraftVelocityReference[] = [];
  return {
    id: "autopilot",
    capabilities: [
      createAutonomousControlProvider(),
      createPropulsionResolverProvider(),
    ],
    hooks: {
      controls: createControlPlugin(references),
      worldModel: {
        contributeWorldModel: (_registry, { capabilityRegistry }) => {
          references.push(
            ...getSpacecraftVelocityReferences(capabilityRegistry),
          );
        },
      },
    },
  };
}
