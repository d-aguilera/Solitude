import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { orbitObservationCapability } from "@solitude/plugin-api/telemetry";
import { createOrbitObservationProvider } from "./observation";

export function createPlugin(
  _runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  return {
    id: "orbitObservation",
    capabilities: [
      {
        id: orbitObservationCapability,
        value: createOrbitObservationProvider(),
      },
    ],
  };
}
