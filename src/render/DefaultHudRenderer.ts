import { formatSpeed } from "./formatters.js";
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
      speedMps,
    }: HudRenderParams,
  ): void {
    into.currentThrustLevel = currentThrustLevel;
    into.fps = fps;
    into.pilotCameraLocalOffset = pilotCameraLocalOffset;
    into.profilingEnabled = profilingEnabled;
    into.speed = formatSpeed(speedMps);
  }
}
