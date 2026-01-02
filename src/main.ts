import { initRenderingContexts } from "./setup.js";
import { startGame } from "./game.js";
import { defaultInstrumentationAdapter } from "./profilingFacade.js";

const pilotCanvas = document.getElementById(
  "pilotViewCanvas"
) as HTMLCanvasElement | null;

const topCanvas = document.getElementById(
  "topViewCanvas"
) as HTMLCanvasElement | null;

if (!pilotCanvas || !topCanvas) {
  throw new Error("Required canvases not found in the document");
}

const { ctxPilot, ctxTop } = initRenderingContexts(pilotCanvas, topCanvas);

startGame(ctxPilot, ctxTop, defaultInstrumentationAdapter);
