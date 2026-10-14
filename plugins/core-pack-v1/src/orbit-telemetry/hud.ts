import { formatEntityName } from "@solitude/plugin-api/entity-names";
import type { ExternalHudPanelProvider } from "@solitude/plugin-api/hud";
import { vec3 } from "@solitude/plugin-api/math";
import {
  getDominantBodyPrimaryInto,
  type ExternalGravityPrimary,
} from "@solitude/plugin-api/world";
import { formatSimTime } from "../shared/localization";
import type { OrbitTelemetryLocalization } from "./localization";
import {
  computeOrbitReadoutForPrimaryInto,
  createOrbitReadout,
} from "./orbitReadout";

export function createHudPanel(
  localization: OrbitTelemetryLocalization,
): ExternalHudPanelProvider {
  const orbitReadout = createOrbitReadout();
  const primary: ExternalGravityPrimary = {
    id: "",
    mass: 0,
    radius: 0,
    body: { id: "", position: vec3.zero(), velocity: vec3.zero() },
  };
  const relativePosition = vec3.zero();
  let primaryDisplayNameId = "";
  let primaryDisplayName = "";
  let radialDirection: DeltaVDirection | null = null;
  let tangentialDirection: DeltaVDirection | null = null;

  return {
    writeHud: (grid, context) => {
      const body = context.mainFocus.controlledBody;
      const hasPrimary = getDominantBodyPrimaryInto(
        primary,
        context.world,
        body.position,
      );
      const radiusValid =
        hasPrimary && Number.isFinite(primary.radius) && primary.radius > 0;
      const altitude = radiusValid
        ? vec3.length(
            vec3.subInto(
              relativePosition,
              body.position,
              primary.body.position,
            ),
          ) - primary.radius
        : NaN;
      const hasOrbit =
        hasPrimary &&
        computeOrbitReadoutForPrimaryInto(orbitReadout, body, primary);
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
        grid.addLine(
          "left",
          "orbit.altitude",
          localization.altitudePrefix.concat(
            formatApsisDistance(altitude, localization),
          ),
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
        "orbit.altitude",
        localization.altitudePrefix.concat(
          formatApsisDistance(altitude, localization),
        ),
      );
      grid.addLine(
        "left",
        "orbit.periapsisAltitude",
        localization.periapsisAltitudePrefix.concat(
          formatApsisDistance(
            radiusValid ? orbitReadout.periapsis - primary.radius : NaN,
            localization,
          ),
        ),
      );
      grid.addLine(
        "left",
        "orbit.apoapsisAltitude",
        localization.apoapsisAltitudePrefix.concat(
          formatApsisDistance(
            radiusValid ? orbitReadout.apoapsis - primary.radius : NaN,
            localization,
          ),
        ),
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
