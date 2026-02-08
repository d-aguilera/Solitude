import type { PlanetSceneObject } from "../app/appPorts.js";
import type {
  RenderedFace,
  RenderedView,
  ViewRenderer,
  ViewRenderParams,
} from "./renderPorts.js";
import { renderView } from "./renderView.js";

export class DefaultViewRenderer implements ViewRenderer {
  // Per-view grow-only scratch buffers for shaded faces.
  private shadedFaceBuffer: RenderedFace[] = [];

  render({ mainShip, camera, surface, scene }: ViewRenderParams): RenderedView {
    const overlayBodies: PlanetSceneObject[] = scene.objects.filter(
      (obj): obj is PlanetSceneObject =>
        obj.kind === "planet" || obj.kind === "star",
    );

    return renderView(
      camera,
      surface,
      scene,
      mainShip,
      overlayBodies,
      this.shadedFaceBuffer,
    );
  }
}
