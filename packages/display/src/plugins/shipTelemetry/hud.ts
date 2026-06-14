import { vec3 } from "@solitude/engine/math";
import type { PluginCapabilityRegistry } from "@solitude/engine/plugin";
import type { HudPanelProvider } from "@solitude/hud/provider";
import type { ShipTelemetryLocalization } from "./localization";

const spacecraftOperatorTelemetryCapabilityId =
  "spacecraft.operatorTelemetry.v1";

interface SpacecraftOperatorTelemetryReadout {
  currentThrustLevel: number;
  currentRcsLevel: number;
}

interface SpacecraftOperatorTelemetryProvider {
  readonly telemetry: SpacecraftOperatorTelemetryReadout;
}

export function createHudPanel(
  localization: ShipTelemetryLocalization,
): HudPanelProvider {
  let telemetry: SpacecraftOperatorTelemetryReadout | null = null;
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
): SpacecraftOperatorTelemetryReadout | null {
  return (
    registry
      .getAll(spacecraftOperatorTelemetryCapabilityId)
      .find(isSpacecraftOperatorTelemetryProvider)?.telemetry ?? null
  );
}

function isSpacecraftOperatorTelemetryProvider(
  value: unknown,
): value is SpacecraftOperatorTelemetryProvider {
  const candidate =
    value as Partial<SpacecraftOperatorTelemetryProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.telemetry === "object" &&
    candidate.telemetry !== null &&
    typeof candidate.telemetry.currentThrustLevel === "number" &&
    typeof candidate.telemetry.currentRcsLevel === "number"
  );
}
