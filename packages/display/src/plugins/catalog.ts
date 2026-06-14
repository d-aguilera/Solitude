import type { PluginCatalog } from "@solitude/engine/plugin";
import { createAutopilotPlugin } from "@solitude/sim/plugins/autopilot";
import { createSolarSystemPlugin } from "@solitude/sim/plugins/solarSystem";
import { createSpacecraftOperatorPlugin } from "@solitude/sim/plugins/spacecraftOperator";
import { createAxialViewsPlugin } from "./axialViews/index";
import { createBodyLabelsPlugin } from "./bodyLabels/index";
import { createOrbitTelemetryPlugin } from "./orbitTelemetry/index";
import { createShipTelemetryPlugin } from "./shipTelemetry/index";
import { createTrajectoriesPlugin } from "./trajectories/index";
import { createVelocitySegmentsPlugin } from "./velocitySegments/index";

export const displayPluginIds = [
  "bodyLabels",
  "axialViews",
  "orbitTelemetry",
  "shipTelemetry",
  "trajectories",
  "velocitySegments",
];

export const remoteRenderPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "orbitTelemetry",
  "shipTelemetry",
  "autopilot",
  "bodyLabels",
  "axialViews",
  "trajectories",
  "velocitySegments",
];

export const displayPluginCatalog: PluginCatalog = {
  axialViews: createAxialViewsPlugin,
  bodyLabels: createBodyLabelsPlugin,
  orbitTelemetry: createOrbitTelemetryPlugin,
  shipTelemetry: createShipTelemetryPlugin,
  trajectories: createTrajectoriesPlugin,
  velocitySegments: createVelocitySegmentsPlugin,
};

export const remoteRenderPluginCatalog: PluginCatalog = {
  ...displayPluginCatalog,
  autopilot: createAutopilotPlugin,
  solarSystem: createSolarSystemPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
};
