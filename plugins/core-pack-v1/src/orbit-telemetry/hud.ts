import type { ExternalPluginCapabilityRegistry } from "@solitude/plugin-api/capabilities";
import { formatEntityName } from "@solitude/plugin-api/entity-names";
import type { ExternalHudPanelProvider } from "@solitude/plugin-api/hud";
import {
  createOrbitReadout,
  isOrbitReadoutProvider,
  orbitObservationCapability,
  type ExternalOrbitReadoutProvider,
} from "@solitude/plugin-api/telemetry";
import { formatSimTime } from "../shared/localization";
import type { OrbitTelemetryLocalization } from "./localization";
export function createHudPanel(
  localization: OrbitTelemetryLocalization,
): ExternalHudPanelProvider & {
  bindObserver: (registry: ExternalPluginCapabilityRegistry) => void;
} {
  const orbitReadout = createOrbitReadout();
  let observer: ExternalOrbitReadoutProvider | null = null;
  let primaryDisplayNameId = "";
  let primaryDisplayName = "";
  let radialDirection: DeltaVDirection | null = null;
  let tangentialDirection: DeltaVDirection | null = null;

  const bindObserver = (registry: ExternalPluginCapabilityRegistry) => {
    const providers = registry
      .getAll(orbitObservationCapability)
      .filter(isOrbitReadoutProvider);
    if (providers.length !== 1)
      throw new Error("Orbit telemetry requires one orbital readout provider");
    observer = providers[0];
  };
  return {
    bindObserver,
    writeHud: (grid, context) => {
      const body = context.mainFocus.controlledBody;
      // Remote presentation hosts do not assemble simulation lifecycle hooks.
      if (!observer) bindObserver(context.capabilityRegistry);
      const hasOrbit = observer!.readoutInto(
        orbitReadout,
        context.world,
        body.id,
      );
      const radiusValid =
        Number.isFinite(orbitReadout.primaryRadius) &&
        orbitReadout.primaryRadius > 0;
      const altitude = orbitReadout.altitudeMeters ?? NaN;
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
            radiusValid
              ? orbitReadout.periapsis - orbitReadout.primaryRadius
              : NaN,
            localization,
          ),
        ),
      );
      grid.addLine(
        "left",
        "orbit.apoapsisAltitude",
        localization.apoapsisAltitudePrefix.concat(
          formatApsisDistance(
            radiusValid
              ? orbitReadout.apoapsis - orbitReadout.primaryRadius
              : NaN,
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
