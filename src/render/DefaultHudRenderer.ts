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
      fps,
      pilotCameraLocalOffset,
      profilingEnabled,
      simTimeSeconds,
      speedMps,
    }: HudRenderParams,
  ): void {
    into.currentThrustLevel = currentThrustLevel;
    into.fps = fps;
    into.pilotCameraLocalOffset = pilotCameraLocalOffset;
    into.profilingEnabled = profilingEnabled;
    into.simTime = formatSimTime(simTimeSeconds);
    into.speed = formatSpeed(speedMps);
  }
}
