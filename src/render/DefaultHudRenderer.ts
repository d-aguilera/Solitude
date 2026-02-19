import { formatSimTime, formatSpeed } from "./formatters.js";
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
      pilotCameraLocalOffset,
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

    // Pilot camera local offset (right, forward, up)
    const { x: ox, y: oy, z: oz } = pilotCameraLocalOffset;
    hudRow1[0] = "Cam:".concat(
      " x=",
      ox.toFixed(2),
      " y=",
      oy.toFixed(2),
      " z=",
      oz.toFixed(2),
    );

    // Thrust
    const thrustPadding = currentThrustLevel < 0 ? "" : " ";
    hudRow1[1] = "Thrust: ".concat(
      thrustPadding,
      currentThrustLevel.toString(),
    );

    // Simulation time
    hudRow2[0] = "Sim: ".concat(formatSimTime(simTimeMillis / 1000));

    // Time scale
    hudRow2[1] = "Time scale: ".concat(currentTimeScale.toString());

    // Profiling
    hudRow3[1] = profilingEnabled ? "PROFILING" : "";
  }
}
