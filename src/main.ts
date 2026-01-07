import { startGame } from "./game.js";
import { defaultProfiler } from "./profilingFacade.js";
import { init as initResizeHandler } from "./resizeHandler.js";

const container = document.querySelector(".canvas-container");
if (!container) {
  throw new Error("Required '.canvas-container' not found in document");
}

const pilotCanvas = document.getElementById(
  "pilotViewCanvas"
) as HTMLCanvasElement | null;

if (!pilotCanvas) {
  throw new Error("Required 'pilotViewCanvas' not found in document");
}

const pilotContext = pilotCanvas.getContext("2d");
if (!pilotContext) {
  throw new Error("Failed to get 2D context for pilot view canvas");
}

const topCanvas = document.getElementById(
  "topViewCanvas"
) as HTMLCanvasElement | null;

if (!topCanvas) {
  throw new Error("Required 'topViewCanvas' not found in document");
}

const topContext = topCanvas.getContext("2d");
if (!topContext) {
  throw new Error("Failed to get 2D context for top view canvas");
}

initResizeHandler(container, pilotCanvas, topCanvas);
startGame(pilotContext, topContext, defaultProfiler);
