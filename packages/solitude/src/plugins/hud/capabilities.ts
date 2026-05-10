import type { ControlInput } from "@solitude/engine/app/controlPorts";
import type { PluginCapabilityProvider } from "@solitude/engine/app/pluginPorts";
import type { FocusContext } from "@solitude/engine/app/runtimePorts";
import type { World } from "@solitude/engine/domain/domainPorts";
import type { HudGrid } from "./grid";

export const hudPanelCapability = "solitude.hud.panel.v1";

export interface HudContext {
  nowMs: number;
  world: World;
  mainFocus: FocusContext;
  controlInput: ControlInput;
  simTimeMillis: number;
}

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
