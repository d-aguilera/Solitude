import type { HudGrid } from "@solitude/engine/app/hudPorts";
import type {
  HudContext,
  PluginCapabilityProvider,
} from "@solitude/engine/app/pluginPorts";

export const hudPanelCapability = "solitude.hud.panel.v1";

export interface HudPanelProvider {
  writeHud: (grid: HudGrid, context: HudContext) => void;
}

export function createHudPanelProvider(
  provider: HudPanelProvider,
): PluginCapabilityProvider {
  return {
    id: hudPanelCapability,
    value: provider,
  };
}

export function isHudPanelProvider(value: unknown): value is HudPanelProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "writeHud" in value &&
    typeof value.writeHud === "function"
  );
}
