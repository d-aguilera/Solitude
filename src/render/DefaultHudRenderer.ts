import type { HudCell, HudRenderParams } from "../app/hudPorts";
import { formatDistance, formatSimTime, formatSpeed } from "./formatters";
import type { HudRenderer, RenderedHud } from "./renderPorts";

export class DefaultHudRenderer implements HudRenderer {
  renderInto(
    into: RenderedHud,
    {
      currentRcsLevel,
      currentThrustLevel,
      currentTimeScale,
      hudCells,
      orbitReadout,
      paused,
      profilingEnabled,
      simTimeMillis,
      speedMps,
    }: HudRenderParams,
  ): void {
    const hudRow0 = into[0];
    const hudRow1 = into[1];
    const hudRow2 = into[2];
    const hudRow3 = into[3];
    const hudRow4 = into[4];

    // Fifth column: general flight info (right-aligned)
    hudRow0[4] = "Speed: ".concat(formatSpeed(speedMps));
    const thrustPadding = currentThrustLevel < 0 ? "" : " ";
    hudRow1[4] = "Thrust: ".concat(
      thrustPadding,
      currentThrustLevel.toString(),
    );
    const rcsPadding = currentRcsLevel < 0 ? "" : " ";
    hudRow2[4] = "RCS: ".concat(rcsPadding, currentRcsLevel.toFixed(2));
    hudRow3[4] = "Time: ".concat(
      formatSimTime(simTimeMillis / 1000),
      " x",
      currentTimeScale.toString(),
    );

    // Fourth column: reserved for plugins
    hudRow0[3] = "";
    hudRow1[3] = "";
    hudRow2[3] = "";
    hudRow3[3] = "";

    // Left column: orbit aids
    if (orbitReadout) {
      const radDv = orbitReadout.deltaVCircularRadial;
      const tanDv = orbitReadout.deltaVCircularTangential;
      const timeToPe = orbitReadout.timeToPeriapsisSec;
      const timeToAp = orbitReadout.timeToApoapsisSec;

      // Left panel: orbit info
      hudRow0[0] = "Orbit: ".concat(
        displayNameFromId(orbitReadout.primaryId),
        " (",
        orbitReadout.isBound ? "bound" : "escape",
        ")",
      );
      hudRow1[0] = orbitReadout.isBound
        ? "Pe/Ap: ".concat(
            formatSignedDistance(
              orbitReadout.periapsis - orbitReadout.primaryRadius,
            ),
            " / ",
            formatSignedDistance(
              orbitReadout.apoapsis - orbitReadout.primaryRadius,
            ),
          )
        : "Pe/Ap: --";
      hudRow2[0] = "e: ".concat(orbitReadout.eccentricity.toFixed(3));
      hudRow3[0] = "i: ".concat(
        ((orbitReadout.inclinationRad * 180) / Math.PI).toFixed(1),
        "°",
      );

      // Second column: delta-v
      hudRow0[1] = "Δv Rad: "
        .concat(formatDeltaV(Math.abs(radDv)), " ")
        .concat(radDv >= 0 ? "out" : "in");
      hudRow1[1] = "Δv Tan: "
        .concat(formatDeltaV(Math.abs(tanDv)), " ")
        .concat(tanDv >= 0 ? "pro" : "retro");
      hudRow2[1] = paused ? "PAUSED" : "";
      hudRow3[1] = "";

      // Third column: apsis timers + profiling
      hudRow0[2] =
        timeToPe == null
          ? "Pe in: --"
          : "Pe in: ".concat(formatSimTime(timeToPe));
      hudRow1[2] =
        timeToAp == null
          ? "Ap in: --"
          : "Ap in: ".concat(formatSimTime(timeToAp));
      hudRow2[2] = profilingEnabled ? "PROFILING" : "";
      hudRow3[2] = "";
    } else {
      hudRow0[0] = "";
      hudRow1[0] = "";
      hudRow2[0] = "";
      hudRow3[0] = "";
      hudRow0[1] = "";
      hudRow1[1] = "";
      hudRow2[1] = "";
      hudRow3[1] = "";
      hudRow0[2] = "";
      hudRow1[2] = "";
      hudRow2[2] = "";
      hudRow3[2] = "";
    }

    if (hudRow4) {
      hudRow4[0] = "";
      hudRow4[1] = "";
      hudRow4[2] = "";
      hudRow4[3] = "";
      hudRow4[4] = "";
    }

    if (hudCells.length) {
      applyHudCells(into, hudCells);
    }
  }
}

function displayNameFromId(id: string): string {
  const parts = id.split(":");
  const raw = parts[parts.length - 1] || id;
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

function applyHudCells(into: RenderedHud, cells: HudCell[]): void {
  for (const cell of cells) {
    const row = into[cell.row];
    if (!row) continue;
    if (cell.col < 0 || cell.col >= row.length) continue;
    row[cell.col] = cell.text;
  }
}
