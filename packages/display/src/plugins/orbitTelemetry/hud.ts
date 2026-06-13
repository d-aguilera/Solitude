import { formatSimTime } from "@solitude/engine/render";
import type { HudPanelProvider } from "@solitude/sim/hud/provider";
import { type SolitudeLocalization } from "@solitude/sim/localization";
import { computeOrbitReadoutInto, createOrbitReadout } from "./orbitReadout";

export function createHudPanel(
  localization: SolitudeLocalization,
): HudPanelProvider {
  const { hud } = localization;
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
        primaryDisplayName = localization.formatEntityName(
          orbitReadout.primaryId,
          undefined,
        );
      }

      grid.addLine(
        "left",
        "orbit.primary",
        hud.orbitPrefix.concat(
          primaryDisplayName,
          " (",
          orbitReadout.isBound ? hud.orbitBound : hud.orbitEscape,
          ")",
        ),
      );
      grid.addLine(
        "left",
        "orbit.peAp",
        orbitReadout.isBound
          ? hud.periapsisApoapsis(
              formatSignedDistance(
                orbitReadout.periapsis - orbitReadout.primaryRadius,
                localization,
              ),
              formatSignedDistance(
                orbitReadout.apoapsis - orbitReadout.primaryRadius,
                localization,
              ),
            )
          : hud.peApEmpty,
      );
      grid.addLine(
        "left",
        "orbit.eccentricity",
        hud.eccentricityPrefix.concat(
          localization.formatFixed(orbitReadout.eccentricity, 3),
        ),
      );
      grid.addLine(
        "left",
        "orbit.inclination",
        hud.inclinationPrefix.concat(
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
        hud.deltaVRadialPrefix.concat(
          localization.formatDeltaV(Math.abs(radDv)),
          " ",
          radDv >= 0 ? hud.outbound : hud.inbound,
        ),
      );
      grid.addLine(
        "leftCenter",
        "orbit.deltaVTangential",
        hud.deltaVTangentialPrefix.concat(
          localization.formatDeltaV(Math.abs(tanDv)),
          " ",
          tanDv >= 0 ? hud.prograde : hud.retrograde,
        ),
      );

      grid.addLine(
        "leftCenter",
        "orbit.timeToPeriapsis",
        timeToPe == null
          ? hud.periapsisTimeEmpty
          : hud.periapsisIn(formatSimTime(timeToPe)),
      );
      grid.addLine(
        "leftCenter",
        "orbit.timeToApoapsis",
        timeToAp == null
          ? hud.apoapsisTimeEmpty
          : hud.apoapsisIn(formatSimTime(timeToAp)),
      );
    },
  };
}

function formatSignedDistance(
  distanceMeters: number,
  localization: SolitudeLocalization,
): string {
  return distanceMeters < 0
    ? "-".concat(localization.formatDistance(-distanceMeters))
    : localization.formatDistance(distanceMeters);
}
