import { HEIGHT, WIDTH } from "./config.js";

export function initRenderingContexts(
  pilotCanvas: HTMLCanvasElement,
  topCanvas: HTMLCanvasElement
): {
  pilotContext: CanvasRenderingContext2D;
  topContext: CanvasRenderingContext2D;
} {
  pilotCanvas.width = WIDTH;
  pilotCanvas.height = HEIGHT;

  const pilotContext = pilotCanvas.getContext("2d");
  if (!pilotContext) {
    throw new Error("Failed to get 2D context for pilot view canvas");
  }

  topCanvas.width = WIDTH;
  topCanvas.height = HEIGHT;

  const topContext = topCanvas.getContext("2d");
  if (!topContext) {
    throw new Error("Failed to get 2D context for top view canvas");
  }

  return { pilotContext, topContext };
}
