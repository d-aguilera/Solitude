import type { PluginCatalog } from "@solitude/engine/plugin";
import { createSolarSystemPlugin } from "@solitude/sim/plugins/solarSystem";
import { createSpacecraftOperatorPlugin } from "@solitude/sim/plugins/spacecraftOperator";
import { createAutopilotPlugin } from "./autopilot/index";
import { createAxialViewsPlugin } from "./axialViews/index";
import { createBodyLabelsPlugin } from "./bodyLabels/index";
import { createOrbitSegmentsPlugin } from "./orbitSegments/index";
import { createOrbitTelemetryPlugin } from "./orbitTelemetry/index";
import { createShipTelemetryPlugin } from "./shipTelemetry/index";
import { createTargetingLaserPlugin } from "./targetingLaser/index";
import { createTrajectoriesPlugin } from "./trajectories/index";
import { createVelocitySegmentsPlugin } from "./velocitySegments/index";

export const displayPluginIds = [
  "bodyLabels",
  "axialViews",
  "orbitSegments",
  "orbitTelemetry",
  "shipTelemetry",
  "targetingLaser",
  "trajectories",
  "velocitySegments",
];

export const remoteRenderPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "orbitSegments",
  "orbitTelemetry",
  "shipTelemetry",
  "autopilot",
  "bodyLabels",
  "axialViews",
  "targetingLaser",
  "trajectories",
  "velocitySegments",
];

export const displayPluginCatalog: PluginCatalog = {
  autopilot: createAutopilotPlugin,
  axialViews: createAxialViewsPlugin,
  bodyLabels: createBodyLabelsPlugin,
  orbitSegments: createOrbitSegmentsPlugin,
  orbitTelemetry: createOrbitTelemetryPlugin,
  shipTelemetry: createShipTelemetryPlugin,
  targetingLaser: createTargetingLaserPlugin,
  trajectories: createTrajectoriesPlugin,
  velocitySegments: createVelocitySegmentsPlugin,
};

export const remoteRenderPluginCatalog: PluginCatalog = {
  ...displayPluginCatalog,
  solarSystem: createSolarSystemPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
};
