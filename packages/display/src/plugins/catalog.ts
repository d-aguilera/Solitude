import type { PluginCatalog } from "@solitude/engine/plugin";
import { createAutopilotHudPlugin } from "./autopilot/index";
import { createAxialViewsPlugin } from "./axialViews/index";
import { createBodyLabelsPlugin } from "./bodyLabels/index";
import { createOrbitSegmentsPlugin } from "./orbitSegments/index";
import { createOrbitTelemetryPlugin } from "./orbitTelemetry/index";
import { createShipTelemetryPlugin } from "./shipTelemetry/index";
import { createSolarSystemMaterialsPlugin } from "./solarSystemMaterials/index";
import { createTrajectoriesPlugin } from "./trajectories/index";

export const displayPluginIds = [
  "bodyLabels",
  "axialViews",
  "orbitSegments",
  "solarSystemMaterials",
  "orbitTelemetry",
  "shipTelemetry",
  "trajectories",
];

export const displayPluginCatalog: PluginCatalog = {
  autopilotHud: createAutopilotHudPlugin,
  axialViews: createAxialViewsPlugin,
  bodyLabels: createBodyLabelsPlugin,
  orbitSegments: createOrbitSegmentsPlugin,
  orbitTelemetry: createOrbitTelemetryPlugin,
  shipTelemetry: createShipTelemetryPlugin,
  solarSystemMaterials: createSolarSystemMaterialsPlugin,
  trajectories: createTrajectoriesPlugin,
};
