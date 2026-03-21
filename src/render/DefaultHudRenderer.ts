import { formatDistance, formatSimTime, formatSpeed } from "./formatters.js";
import type {
  HudRenderer,
  HudRenderParams,
  RenderedHud,
} from "./renderPorts.js";

export class DefaultHudRenderer implements HudRenderer {
  renderInto(
    into: RenderedHud,
    {
      currentThrustLevel,
      currentTimeScale,
      fps,
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

    // Speed
    hudRow0[0] = "Speed: ".concat(formatSpeed(speedMps));

    // FPS
    const fpsPadding = fps < 10 ? " " : "";
    hudRow0[1] = "FPS: ".concat(fpsPadding, fps.toFixed(0));

    // Thrust
    const thrustPadding = currentThrustLevel < 0 ? "" : " ";
    hudRow1[0] = "Thrust: ".concat(
      thrustPadding,
      currentThrustLevel.toString(),
    );

    // Time scale
    hudRow1[1] = "Time scale: ".concat(currentTimeScale.toString());

    // Orbit readout
    if (orbitReadout) {
      const primaryName = displayNameFromId(orbitReadout.primaryId);
      const orbitStatus = orbitReadout.isBound ? "bound" : "escape";
      const pe = orbitReadout.periapsis;
      const ap = orbitReadout.apoapsis;
      const ecc = orbitReadout.eccentricity;
      const incDeg = (orbitReadout.inclinationRad * 180) / Math.PI;
      const peAlt = pe - orbitReadout.primaryRadius;
      const apAlt = ap - orbitReadout.primaryRadius;

      hudRow2[0] = "Orbit: ".concat(primaryName, " (", orbitStatus, ")");
      hudRow2[1] = orbitReadout.isBound
        ? "Pe/Ap: ".concat(
            formatSignedDistance(peAlt),
            " / ",
            formatSignedDistance(apAlt),
          )
        : "Pe/Ap: --";

      hudRow3[0] = "e=".concat(ecc.toFixed(3), " i=")
        .concat(incDeg.toFixed(1), "°");
    } else {
      hudRow3[0] = "";
    }

    // Status flags
    const simLabel = "Sim: ".concat(formatSimTime(simTimeMillis / 1000));
    if (paused && profilingEnabled) {
      hudRow3[1] = simLabel.concat(" PAUSED PROFILING");
    } else if (paused) {
      hudRow3[1] = simLabel.concat(" PAUSED");
    } else if (profilingEnabled) {
      hudRow3[1] = simLabel.concat(" PROFILING");
    } else {
      hudRow3[1] = simLabel;
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
