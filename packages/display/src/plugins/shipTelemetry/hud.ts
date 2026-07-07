import { vec3 } from "@solitude/engine/math";
import type { PluginCapabilityRegistry } from "@solitude/engine/plugin";
import type { HudPanelProvider } from "@solitude/hud/provider";
import {
  isSpacecraftOperatorTelemetryProvider,
  spacecraftOperatorTelemetryCapabilityId,
  type SpacecraftOperatorTelemetry,
} from "@solitude/hud/telemetry";
import type { ShipTelemetryLocalization } from "./localization";

export function createHudPanel(
  localization: ShipTelemetryLocalization,
): HudPanelProvider {
  let telemetry: SpacecraftOperatorTelemetry | null = null;
  let telemetryResolved = false;

  return {
    writeHud: (grid, context) => {
      const speedMps = vec3.length(context.mainFocus.controlledBody.velocity);
      grid.addLine(
        "right",
        "ship.speed",
        localization.speedPrefix.concat(localization.formatSpeed(speedMps)),
      );

      if (!telemetryResolved) {
        telemetry = resolveTelemetry(context.capabilityRegistry);
        telemetryResolved = true;
      }
      if (!telemetry) return;

      const thrustPadding = telemetry.currentThrustLevel < 0 ? "" : " ";
      grid.addLine(
        "right",
        "ship.thrust",
        localization.thrustPrefix.concat(
          thrustPadding,
          telemetry.currentThrustLevel.toString(),
        ),
      );

      const rcsPadding = telemetry.currentRcsLevel < 0 ? "" : " ";
      grid.addLine(
        "right",
        "ship.rcs",
        localization.rcsPrefix.concat(
          rcsPadding,
          localization.formatFixed(telemetry.currentRcsLevel, 2),
        ),
      );
    },
  };
}

function resolveTelemetry(
  registry: PluginCapabilityRegistry,
): SpacecraftOperatorTelemetry | null {
  return (
    registry
      .getAll(spacecraftOperatorTelemetryCapabilityId)
      .find(isSpacecraftOperatorTelemetryProvider)?.telemetry ?? null
  );
}
