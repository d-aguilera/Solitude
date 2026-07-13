import type { PluginCatalog } from "@solitude/engine/plugin";
import { createAutopilotHudPlugin } from "./autopilot/index";
import { createOrbitTelemetryPlugin } from "./orbitTelemetry/index";
import { createShipTelemetryPlugin } from "./shipTelemetry/index";

export const displayPluginIds = ["orbitTelemetry", "shipTelemetry"];

export const displayPluginCatalog: PluginCatalog = {
  autopilotHud: createAutopilotHudPlugin,
  orbitTelemetry: createOrbitTelemetryPlugin,
  shipTelemetry: createShipTelemetryPlugin,
};
