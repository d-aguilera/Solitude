import type { PluginCatalog } from "@solitude/engine/plugin";
import { createAutopilotHudPlugin } from "./autopilot/index";
import { createAxialViewsPlugin } from "./axialViews/index";
import { createBodyLabelsPlugin } from "./bodyLabels/index";
import { createOrbitTelemetryPlugin } from "./orbitTelemetry/index";
import { createShipTelemetryPlugin } from "./shipTelemetry/index";

export const displayPluginIds = [
  "bodyLabels",
  "axialViews",
  "orbitTelemetry",
  "shipTelemetry",
];

export const displayPluginCatalog: PluginCatalog = {
  autopilotHud: createAutopilotHudPlugin,
  axialViews: createAxialViewsPlugin,
  bodyLabels: createBodyLabelsPlugin,
  orbitTelemetry: createOrbitTelemetryPlugin,
  shipTelemetry: createShipTelemetryPlugin,
};
