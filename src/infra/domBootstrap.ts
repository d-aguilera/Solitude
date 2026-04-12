import type { WorldAndSceneConfig } from "../app/configPorts";
import type { GravityEngine } from "../domain/domainPorts";
import { parameters } from "../global/parameters";
import { loadPlugins } from "../plugins/index";
import { DefaultHudRenderer } from "../render/DefaultHudRenderer";
import { DefaultViewRenderer } from "../render/DefaultViewRenderer";
import type {
  HudRenderer,
  Rasterizer,
  RenderSurface2D,
  ViewRenderer,
} from "../render/renderPorts";
import { runLoop } from "./domGameLoop";
import { initInput } from "./domKeyboardInput";
import { initLayout } from "./domLayout";
import { NewtonianGravityEngine } from "./NewtonianGravityEngine";

/**
 * DOM-level bootstrap
 */
export function bootstrapWith(
  config: WorldAndSceneConfig,
  makeSurface: (canvas: HTMLCanvasElement) => RenderSurface2D,
  makeRasterizer: (canvas: HTMLCanvasElement) => Rasterizer,
): void {
  const plugins = loadPlugins([
    "autopilot",
    "pause",
    "profiling",
    "timeScale",
    "trajectories",
    "velocitySegments",
  ]);
  const container = document.querySelector(".canvas-container");
  if (!container) {
    throw new Error("Required '.canvas-container' not found in document");
  }

  const pilotCanvas = document.getElementById(
    "pilotViewCanvas",
  ) as HTMLCanvasElement | null;
  if (!pilotCanvas) {
    throw new Error("Required 'pilotViewCanvas' not found in document");
  }

  const topCanvas = document.getElementById(
    "topViewCanvas",
  ) as HTMLCanvasElement | null;
  if (!topCanvas) {
    throw new Error("Required 'topViewCanvas' not found in document");
  }

  const leftCanvas = document.getElementById(
    "leftViewCanvas",
  ) as HTMLCanvasElement | null;
  if (!leftCanvas) {
    throw new Error("Required 'leftViewCanvas' not found in document");
  }

  const rightCanvas = document.getElementById(
    "rightViewCanvas",
  ) as HTMLCanvasElement | null;
  if (!rightCanvas) {
    throw new Error("Required 'rightViewCanvas' not found in document");
  }

  const rearCanvas = document.getElementById(
    "rearViewCanvas",
  ) as HTMLCanvasElement | null;
  if (!rearCanvas) {
    throw new Error("Required 'rearViewCanvas' not found in document");
  }

  initLayout(
    container,
    pilotCanvas,
    topCanvas,
    leftCanvas,
    rightCanvas,
    rearCanvas,
  );

  const pilotSurface: RenderSurface2D = makeSurface(pilotCanvas);
  const topSurface: RenderSurface2D = makeSurface(topCanvas);
  const leftSurface: RenderSurface2D = makeSurface(leftCanvas);
  const rightSurface: RenderSurface2D = makeSurface(rightCanvas);
  const rearSurface: RenderSurface2D = makeSurface(rearCanvas);

  const gravityEngine: GravityEngine = new NewtonianGravityEngine(
    parameters.newtonG,
    parameters.softeningLength,
  );

  const pilotRasterizer: Rasterizer = makeRasterizer(pilotCanvas);
  const pilotViewRenderer: ViewRenderer = new DefaultViewRenderer(
    (text: string, font: string) => pilotRasterizer.measureText(text, font),
  );

  const topRasterizer: Rasterizer = makeRasterizer(topCanvas);
  const topViewRenderer: ViewRenderer = new DefaultViewRenderer(
    (text: string, font: string) => topRasterizer.measureText(text, font),
    "nameOnly",
  );

  const leftRasterizer: Rasterizer = makeRasterizer(leftCanvas);
  const leftViewRenderer: ViewRenderer = new DefaultViewRenderer(
    (text: string, font: string) => leftRasterizer.measureText(text, font),
    "nameOnly",
  );

  const rightRasterizer: Rasterizer = makeRasterizer(rightCanvas);
  const rightViewRenderer: ViewRenderer = new DefaultViewRenderer(
    (text: string, font: string) => rightRasterizer.measureText(text, font),
    "nameOnly",
  );

  const rearRasterizer: Rasterizer = makeRasterizer(rearCanvas);
  const rearViewRenderer: ViewRenderer = new DefaultViewRenderer(
    (text: string, font: string) => rearRasterizer.measureText(text, font),
    "nameOnly",
  );

  const hudRasterizer = pilotRasterizer;
  const hudRenderer: HudRenderer = new DefaultHudRenderer();

  const { controlInput } = initInput(plugins);

  runLoop({
    config,
    pilotViewRenderer,
    pilotRasterizer,
    topViewRenderer,
    topRasterizer,
    leftViewRenderer,
    leftRasterizer,
    rightViewRenderer,
    rightRasterizer,
    rearViewRenderer,
    rearRasterizer,
    hudRenderer,
    hudRasterizer,
    gravityEngine,
    pilotSurface,
    topSurface,
    leftSurface,
    rightSurface,
    rearSurface,
    controlInput,
    plugins,
  });
}
