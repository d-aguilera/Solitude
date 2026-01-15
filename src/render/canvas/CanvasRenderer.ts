import type { Renderer } from "../../app/rendererPort.js";
import type { Plane, Scene, WorldState } from "../../world/types.js";
import { renderHUD } from "../../app/hud.js";
import type { Profiler, Vec3 } from "../../world/domain.js";
import { DEFAULT_DRAW_MODE } from "../../app/config.js";
import { buildPilotView, buildTopView } from "../../app/viewComposition.js";
import {
  createInitialSceneAndWorld,
  syncPlanesToSceneObjects,
  syncPlanetsToSceneObjects,
  syncStarsToSceneObjects,
  syncLightsToStars,
} from "../../world/worldSetup.js";
import { CanvasViewRenderer } from "./CanvasViewRenderer.js";

/**
 * Canvas2D implementation of the top-level Renderer abstraction.
 *
 * This adapter owns its internal ViewRenderer and is responsible
 * for composing pilot/top views and HUD into the associated canvases.
 * It is constructed by an outer composition root.
 */
export class CanvasRenderer implements Renderer {
  private readonly viewRenderer: CanvasViewRenderer;

  // Renderer‑local scene and camera ids. World state is supplied
  // by the app each frame and kept in sync with this scene.
  private readonly scene: Scene;
  private readonly topCameraId: string;
  private readonly pilotCameraId: string;

  constructor() {
    this.viewRenderer = new CanvasViewRenderer();

    // Initialize a local scene/world wiring for rendering.
    // The app/game world is passed in each frame and kept in sync.
    const { scene, world, topCameraId, pilotCameraId } =
      createInitialSceneAndWorld();

    this.scene = scene;
    this.topCameraId = topCameraId;
    this.pilotCameraId = pilotCameraId;

    // Initial sync from this initial world into the scene.
    syncPlanesToSceneObjects(world, this.scene);
    syncPlanetsToSceneObjects(world, this.scene);
    syncStarsToSceneObjects(world, this.scene);
    syncLightsToStars(world, this.scene);
  }

  renderFrame(params: {
    world: WorldState;
    mainPlane: Plane;
    pilotContext: CanvasRenderingContext2D;
    topContext: CanvasRenderingContext2D;
    profiler: Profiler;
    pilotCameraLocalOffset: Vec3;
    thrustPercent: number;
    profilingEnabled: boolean;
  }): void {
    const {
      world,
      mainPlane,
      pilotContext,
      topContext,
      profiler,
      pilotCameraLocalOffset,
      thrustPercent,
      profilingEnabled,
    } = params;

    // Keep renderer-facing scene in sync with current world state.
    syncPlanesToSceneObjects(world, this.scene);
    syncPlanetsToSceneObjects(world, this.scene);
    syncStarsToSceneObjects(world, this.scene);
    syncLightsToStars(world, this.scene);

    const debugPlanes = world.planes;

    // Build pilot view configuration for the current canvas size.
    const pilotViewConfig = buildPilotView(
      world,
      this.pilotCameraId,
      mainPlane,
      DEFAULT_DRAW_MODE,
      debugPlanes,
      pilotContext.canvas.width,
      pilotContext.canvas.height
    );

    // Build top view configuration and filtered scene.
    const { viewConfig: topViewConfig, scene: topScene } = buildTopView(
      world,
      this.scene,
      this.topCameraId,
      mainPlane,
      DEFAULT_DRAW_MODE,
      debugPlanes,
      topContext.canvas.width,
      topContext.canvas.height
    );

    // Pilot view uses the full scene.
    this.viewRenderer.renderView({
      context: pilotContext,
      scene: this.scene,
      viewConfig: pilotViewConfig,
      profiler,
    });

    // Top view uses a scene that may omit some objects.
    this.viewRenderer.renderView({
      context: topContext,
      scene: topScene,
      viewConfig: topViewConfig,
      profiler,
    });

    // HUD overlay on pilot canvas.
    renderHUD(
      pilotContext,
      mainPlane,
      profilingEnabled,
      pilotCameraLocalOffset,
      thrustPercent
    );
  }
}
