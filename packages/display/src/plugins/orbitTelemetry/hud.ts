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

      grid[0][0] = hud.orbitPrefix.concat(
        primaryDisplayName,
        " (",
        orbitReadout.isBound ? hud.orbitBound : hud.orbitEscape,
        ")",
      );
      grid[1][0] = orbitReadout.isBound
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
        : hud.peApEmpty;
      grid[2][0] = hud.eccentricityPrefix.concat(
        localization.formatFixed(orbitReadout.eccentricity, 3),
      );
      grid[3][0] = hud.inclinationPrefix.concat(
        localization.formatFixed(
          (orbitReadout.inclinationRad * 180) / Math.PI,
          1,
        ),
        "°",
      );

      grid[0][1] = hud.deltaVRadialPrefix.concat(
        localization.formatDeltaV(Math.abs(radDv)),
        " ",
        radDv >= 0 ? hud.outbound : hud.inbound,
      );
      grid[1][1] = hud.deltaVTangentialPrefix.concat(
        localization.formatDeltaV(Math.abs(tanDv)),
        " ",
        tanDv >= 0 ? hud.prograde : hud.retrograde,
      );

      grid[0][2] =
        timeToPe == null
          ? hud.periapsisTimeEmpty
          : hud.periapsisIn(formatSimTime(timeToPe));
      grid[1][2] =
        timeToAp == null
          ? hud.apoapsisTimeEmpty
          : hud.apoapsisIn(formatSimTime(timeToAp));
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
