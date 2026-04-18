import type { HudPlugin } from "../../app/pluginPorts";
import {
  computeShipOrbitReadoutInto,
  createOrbitReadout,
} from "../../domain/orbit";
import { formatDistance, formatSimTime } from "../../render/formatters";

const orbitPrefix = "Orbit: ";
const peApEmpty = "Pe/Ap: --";
const eccentricityPrefix = "e: ";
const inclinationPrefix = "i: ";
const deltaVRadPrefix = "Δv Rad: ";
const deltaVTanPrefix = "Δv Tan: ";
const periapsisTimeEmpty = "Pe in: --";
const apoapsisTimeEmpty = "Ap in: --";

export function createHudPlugin(): HudPlugin {
  const orbitReadout = createOrbitReadout();
  let primaryDisplayNameId = "";
  let primaryDisplayName = "";

  return {
    updateHudParams: (grid, { mainShip, world }) => {
      const hasOrbit = computeShipOrbitReadoutInto(
        orbitReadout,
        world,
        mainShip,
      );
      if (!hasOrbit) return;

      const radDv = orbitReadout.deltaVCircularRadial;
      const tanDv = orbitReadout.deltaVCircularTangential;
      const timeToPe = orbitReadout.timeToPeriapsisSec;
      const timeToAp = orbitReadout.timeToApoapsisSec;
      if (primaryDisplayNameId !== orbitReadout.primaryId) {
        primaryDisplayNameId = orbitReadout.primaryId;
        primaryDisplayName = formatDisplayNameFromId(orbitReadout.primaryId);
      }

      grid[0][0] = orbitPrefix.concat(
        primaryDisplayName,
        " (",
        orbitReadout.isBound ? "bound" : "escape",
        ")",
      );
      grid[1][0] = orbitReadout.isBound
        ? "Pe/Ap: ".concat(
            formatSignedDistance(
              orbitReadout.periapsis - orbitReadout.primaryRadius,
            ),
            " / ",
            formatSignedDistance(
              orbitReadout.apoapsis - orbitReadout.primaryRadius,
            ),
          )
        : peApEmpty;
      grid[2][0] = eccentricityPrefix.concat(
        orbitReadout.eccentricity.toFixed(3),
      );
      grid[3][0] = inclinationPrefix.concat(
        ((orbitReadout.inclinationRad * 180) / Math.PI).toFixed(1),
        "°",
      );

      grid[0][1] = deltaVRadPrefix.concat(
        formatDeltaV(Math.abs(radDv)),
        " ",
        radDv >= 0 ? "out" : "in",
      );
      grid[1][1] = deltaVTanPrefix.concat(
        formatDeltaV(Math.abs(tanDv)),
        " ",
        tanDv >= 0 ? "pro" : "retro",
      );

      grid[0][2] =
        timeToPe == null
          ? periapsisTimeEmpty
          : "Pe in: ".concat(formatSimTime(timeToPe));
      grid[1][2] =
        timeToAp == null
          ? apoapsisTimeEmpty
          : "Ap in: ".concat(formatSimTime(timeToAp));
    },
  };
}

function formatDisplayNameFromId(id: string): string {
  const separatorIndex = id.lastIndexOf(":");
  const raw = separatorIndex >= 0 ? id.slice(separatorIndex + 1) : id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatSignedDistance(distanceMeters: number): string {
  return distanceMeters < 0
    ? "-".concat(formatDistance(-distanceMeters))
    : formatDistance(distanceMeters);
}

function formatDeltaV(speedMps: number): string {
  if (speedMps >= 1000) {
    return (speedMps / 1000).toFixed(2).concat(" km/s");
  }
  return speedMps.toFixed(2).concat(" m/s");
}
