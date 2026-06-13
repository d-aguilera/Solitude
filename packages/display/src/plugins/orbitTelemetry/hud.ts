import { formatSimTime } from "@solitude/engine/render";
import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import { formatEntityName } from "@solitude/sim/localization";
import type { OrbitTelemetryLocalization } from "./localization";
import { computeOrbitReadoutInto, createOrbitReadout } from "./orbitReadout";

export function createHudPanel(
  localization: OrbitTelemetryLocalization,
): HudPanelProvider {
  const orbitReadout = createOrbitReadout();
  let primaryDisplayNameId = "";
  let primaryDisplayName = "";

  return {
    writeHud: (grid, context) => {
      const hasOrbit = computeOrbitReadoutInto(
        orbitReadout,
        context.world,
        context.mainFocus.controlledBody,
      );
      if (!hasOrbit) return;

      const radDv = orbitReadout.deltaVCircularRadial;
      const tanDv = orbitReadout.deltaVCircularTangential;
      const timeToPe = orbitReadout.timeToPeriapsisSec;
      const timeToAp = orbitReadout.timeToApoapsisSec;
      if (primaryDisplayNameId !== orbitReadout.primaryId) {
        primaryDisplayNameId = orbitReadout.primaryId;
        primaryDisplayName = formatEntityName(
          context.capabilityRegistry,
          orbitReadout.primaryId,
          undefined,
        );
      }

      grid.addLine(
        "left",
        "orbit.primary",
        localization.orbitPrefix.concat(
          primaryDisplayName,
          " (",
          orbitReadout.isBound
            ? localization.orbitBound
            : localization.orbitEscape,
          ")",
        ),
      );
      grid.addLine(
        "left",
        "orbit.peAp",
        orbitReadout.isBound
          ? localization.periapsisApoapsis(
              formatSignedDistance(
                orbitReadout.periapsis - orbitReadout.primaryRadius,
                localization,
              ),
              formatSignedDistance(
                orbitReadout.apoapsis - orbitReadout.primaryRadius,
                localization,
              ),
            )
          : localization.peApEmpty,
      );
      grid.addLine(
        "left",
        "orbit.eccentricity",
        localization.eccentricityPrefix.concat(
          localization.formatFixed(orbitReadout.eccentricity, 3),
        ),
      );
      grid.addLine(
        "left",
        "orbit.inclination",
        localization.inclinationPrefix.concat(
          localization.formatFixed(
            (orbitReadout.inclinationRad * 180) / Math.PI,
            1,
          ),
          "°",
        ),
      );

      grid.addLine(
        "leftCenter",
        "orbit.deltaVRadial",
        localization.deltaVRadialPrefix.concat(
          localization.formatDeltaV(Math.abs(radDv)),
          " ",
          radDv >= 0 ? localization.outbound : localization.inbound,
        ),
      );
      grid.addLine(
        "leftCenter",
        "orbit.deltaVTangential",
        localization.deltaVTangentialPrefix.concat(
          localization.formatDeltaV(Math.abs(tanDv)),
          " ",
          tanDv >= 0 ? localization.prograde : localization.retrograde,
        ),
      );

      grid.addLine(
        "leftCenter",
        "orbit.timeToPeriapsis",
        timeToPe == null
          ? localization.periapsisTimeEmpty
          : localization.periapsisIn(formatSimTime(timeToPe)),
      );
      grid.addLine(
        "leftCenter",
        "orbit.timeToApoapsis",
        timeToAp == null
          ? localization.apoapsisTimeEmpty
          : localization.apoapsisIn(formatSimTime(timeToAp)),
      );
    },
  };
}

function formatSignedDistance(
  distanceMeters: number,
  localization: OrbitTelemetryLocalization,
): string {
  return distanceMeters < 0
    ? "-".concat(localization.formatDistance(-distanceMeters))
    : localization.formatDistance(distanceMeters);
}
