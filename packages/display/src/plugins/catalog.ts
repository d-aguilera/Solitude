import type { PluginCatalog } from "@solitude/engine/plugin";
import { createSolarSystemPlugin } from "@solitude/sim/plugins/solarSystem";
import { createSpacecraftOperatorPlugin } from "@solitude/sim/plugins/spacecraftOperator";
import { createAutopilotPlugin } from "./autopilot/index";
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
  autopilot: createAutopilotPlugin,
  axialViews: createAxialViewsPlugin,
  bodyLabels: createBodyLabelsPlugin,
  orbitTelemetry: createOrbitTelemetryPlugin,
  shipTelemetry: createShipTelemetryPlugin,
  trajectories: createTrajectoriesPlugin,
  velocitySegments: createVelocitySegmentsPlugin,
};

export const remoteRenderPluginCatalog: PluginCatalog = {
  ...displayPluginCatalog,
  solarSystem: createSolarSystemPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
};
