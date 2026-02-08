import type {
  HudRenderer,
  HudRenderParams,
  RenderedHud,
} from "./renderPorts.js";

export class DefaultHudRenderer implements HudRenderer {
  render({
    currentThrustLevel,
    fps,
    pilotCameraLocalOffset,
    profilingEnabled,
    speedMps,
  }: HudRenderParams): RenderedHud {
    return {
      currentThrustLevel,
      fps,
      pilotCameraLocalOffset,
      profilingEnabled,
      speedMps,
    };
  }
}
