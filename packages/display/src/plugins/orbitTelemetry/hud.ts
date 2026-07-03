import { formatSimTime } from "@solitude/engine/render";
import { formatEntityName } from "@solitude/entity-names";
import type { HudPanelProvider } from "@solitude/hud/provider";
import type { OrbitTelemetryLocalization } from "./localization";
import { computeOrbitReadoutInto, createOrbitReadout } from "./orbitReadout";

export function createHudPanel(
  localization: OrbitTelemetryLocalization,
): HudPanelProvider {
  const orbitReadout = createOrbitReadout();
  let primaryDisplayNameId = "";
  let primaryDisplayName = "";
  let radialDirection: DeltaVDirection | null = null;
  let tangentialDirection: DeltaVDirection | null = null;

  return {
    writeHud: (grid, context) => {
      const hasOrbit = computeOrbitReadoutInto(
        orbitReadout,
        context.world,
        context.mainFocus.controlledBody,
      );
      if (!hasOrbit) {
        primaryDisplayNameId = "";
        primaryDisplayName = "";
        radialDirection = null;
        tangentialDirection = null;
        grid.addLine(
          "left",
          "orbit.primary",
          localization.orbitPrefix.concat("--"),
        );
        grid.addLine(
          "left",
          "orbit.distance",
          localization.distancePrefix.concat("--"),
        );
        return;
      }

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
        radialDirection = null;
        tangentialDirection = null;
      }
      radialDirection = resolveDeltaVDirection(radDv, radialDirection);
      tangentialDirection = resolveDeltaVDirection(tanDv, tangentialDirection);

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
        "orbit.distance",
        localization.distancePrefix.concat(
          localization.formatDistance(orbitReadout.distance),
        ),
      );
      grid.addLine(
        "left",
        "orbit.peAp",
        Number.isFinite(orbitReadout.periapsis)
          ? localization.periapsisApoapsis(
              formatSignedDistance(orbitReadout.periapsis, localization),
              formatApsisDistance(orbitReadout.apoapsis, localization),
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
          radialDirection === "positive"
            ? localization.outbound
            : localization.inbound,
        ),
      );
      grid.addLine(
        "leftCenter",
        "orbit.deltaVTangential",
        localization.deltaVTangentialPrefix.concat(
          localization.formatDeltaV(Math.abs(tanDv)),
          " ",
          tangentialDirection === "positive"
            ? localization.prograde
            : localization.retrograde,
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

type DeltaVDirection = "negative" | "positive";

const deltaVDirectionDeadbandMps = 0.01;

function resolveDeltaVDirection(
  deltaV: number,
  previous: DeltaVDirection | null,
): DeltaVDirection {
  if (
    previous &&
    Number.isFinite(deltaV) &&
    Math.abs(deltaV) <= deltaVDirectionDeadbandMps
  ) {
    return previous;
  }
  return deltaV >= 0 ? "positive" : "negative";
}

function formatSignedDistance(
  distanceMeters: number,
  localization: OrbitTelemetryLocalization,
): string {
  return distanceMeters < 0
    ? "-".concat(localization.formatDistance(-distanceMeters))
    : localization.formatDistance(distanceMeters);
}

function formatApsisDistance(
  distanceMeters: number,
  localization: OrbitTelemetryLocalization,
): string {
  return Number.isFinite(distanceMeters)
    ? formatSignedDistance(distanceMeters, localization)
    : "--";
}
