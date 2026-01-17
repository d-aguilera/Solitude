let remove: (() => void) | null = null;

export function init(
  container: Element,
  pilotCanvas: HTMLCanvasElement,
  topCanvas: HTMLCanvasElement
) {
  updatePixelRatio(container, pilotCanvas, topCanvas);

  window.addEventListener("resize", () => {
    resizeCanvases(container, pilotCanvas, topCanvas);
  });
}

function resizeCanvasToCssBox(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number
): void {
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const dpr = window.devicePixelRatio || 1;
  const deviceWidth = Math.round(cssWidth * dpr);
  const deviceHeight = Math.round(cssHeight * dpr);

  if (canvas.width === deviceWidth && canvas.height === deviceHeight) return;

  canvas.width = deviceWidth;
  canvas.height = deviceHeight;
}

function resizeCanvases(
  container: Element,
  pilotCanvas: HTMLCanvasElement,
  topCanvas: HTMLCanvasElement
): void {
  if (!container) return;

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const aspectRatio = 16 / 9;

  // Pilot view: fill entire container while preserving aspect ratio
  let pilotWidth = containerWidth;
  let pilotHeight = pilotWidth / aspectRatio;

  if (pilotHeight > containerHeight) {
    pilotHeight = containerHeight;
    pilotWidth = pilotHeight * aspectRatio;
  }

  resizeCanvasToCssBox(pilotCanvas, pilotWidth, pilotHeight);

  // Top view: 20% of container width, fixed aspect ratio, overlay bottom-right
  const topWidth = containerWidth * 0.2;
  const topHeight = topWidth / aspectRatio;

  // Position via style so it stays in bottom-right
  topCanvas.style.right = "16px";
  topCanvas.style.bottom = "16px";

  resizeCanvasToCssBox(topCanvas, topWidth, topHeight);
}

function updatePixelRatio(
  container: Element,
  pilotCanvas: HTMLCanvasElement,
  topCanvas: HTMLCanvasElement
) {
  // Remove current DPR listener
  remove?.();

  resizeCanvases(container, pilotCanvas, topCanvas);

  // Add new DPR listener
  const mqString = `(resolution: ${window.devicePixelRatio}dppx)`;
  const media = matchMedia(mqString);
  const listener = () => updatePixelRatio(container, pilotCanvas, topCanvas);
  media.addEventListener("change", listener);
  remove = () => {
    media.removeEventListener("change", listener);
  };
}
