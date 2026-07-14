import type { ExternalPluginCapabilityRegistry } from "@solitude/plugin-api/capabilities";
import type { ExternalHudPanelProvider } from "@solitude/plugin-api/hud";
import { vec3 } from "@solitude/plugin-api/math";
import type { ExternalSpacecraftOperatorTelemetry } from "@solitude/plugin-api/telemetry";
import {
  isSpacecraftOperatorTelemetryProvider,
  spacecraftOperatorTelemetryCapability,
} from "@solitude/plugin-api/telemetry";
import type { ShipTelemetryLocalization } from "./localization";

export function createHudPanel(
  localization: ShipTelemetryLocalization,
): ExternalHudPanelProvider {
  let telemetry: ExternalSpacecraftOperatorTelemetry | null = null;
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
  registry: ExternalPluginCapabilityRegistry,
): ExternalSpacecraftOperatorTelemetry | null {
  return (
    registry
      .getAll(spacecraftOperatorTelemetryCapability)
      .find(isSpacecraftOperatorTelemetryProvider)?.telemetry ?? null
  );
}
