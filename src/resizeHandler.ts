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

function resizeCanvas(
  canvas: HTMLCanvasElement,
  newClientWidth: number,
  newClientHeight: number
): void {
  canvas.style.width = `${newClientWidth}px`;
  canvas.style.height = `${newClientHeight}px`;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.round(newClientWidth * dpr);
  const cssHeight = Math.round(newClientHeight * dpr);

  if (canvas.width === cssWidth && canvas.height === cssHeight) return;

  canvas.width = cssWidth;
  canvas.height = cssHeight;

  console.log(
    "[resizeCanvasToCssBox]",
    "id=",
    canvas.id,
    "Device pixels (w,h)=",
    newClientWidth,
    newClientHeight,
    "DPR=",
    dpr,
    "CSS pixels (w,h)=",
    cssWidth,
    cssHeight
  );
}

function resizeCanvases(
  container: Element,
  pilotCanvas: HTMLCanvasElement,
  topCanvas: HTMLCanvasElement
): void {
  if (!container) return;

  // Available width is the container width divided by 2 (for two canvases)
  const availableWidthPerCanvas = container.clientWidth / 2;
  const availableHeight = container.clientHeight;
  const aspectRatio = 16 / 9;

  let newClientWidth, newClientHeight;

  // Calculate dimensions based on available width, then check if height fits
  let widthFromWidth = availableWidthPerCanvas;
  let heightFromWidth = widthFromWidth / aspectRatio;

  // Calculate dimensions based on available height, then check if width fits
  let heightFromHeight = availableHeight;
  let widthFromHeight = heightFromHeight * aspectRatio;

  // Use the dimensions that fit entirely within the available space
  if (heightFromWidth <= availableHeight) {
    newClientWidth = Math.round(widthFromWidth);
    newClientHeight = Math.round(heightFromWidth);
  } else {
    newClientWidth = Math.round(widthFromHeight);
    newClientHeight = Math.round(heightFromHeight);
  }

  resizeCanvas(pilotCanvas, newClientWidth, newClientHeight);
  resizeCanvas(topCanvas, newClientWidth, newClientHeight);
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
