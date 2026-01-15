import type { DrawMode, Plane } from "../world/types.js";
import type { View, ViewDebugOverlay } from "../render/projection/viewTypes.js";

/**
 * Adapter-level container describing how a single view
 * should render the current scene for this frame.
 *
 * Built by the app layer from world state and then passed
 * into the Renderer implementation.
 */
export interface ViewConfig {
  view: View;
  debugOverlay?: ViewDebugOverlay;
  referencePlane: Plane;
  drawMode: DrawMode;
}
