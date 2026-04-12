let remove: (() => void) | null = null;

export function initLayout(
  container: Element,
  pilotCanvas: HTMLCanvasElement,
  topCanvas: HTMLCanvasElement,
  leftCanvas: HTMLCanvasElement,
  rightCanvas: HTMLCanvasElement,
  rearCanvas: HTMLCanvasElement,
) {
  updatePixelRatio(
    container,
    pilotCanvas,
    topCanvas,
    leftCanvas,
    rightCanvas,
    rearCanvas,
  );

  window.addEventListener("resize", () => {
    resizeCanvases(
      container,
      pilotCanvas,
      topCanvas,
      leftCanvas,
      rightCanvas,
      rearCanvas,
    );
  });
}

function resizeCanvasToCssBox(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
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
  topCanvas: HTMLCanvasElement,
  leftCanvas: HTMLCanvasElement,
  rightCanvas: HTMLCanvasElement,
  rearCanvas: HTMLCanvasElement,
): void {
  if (!container) return;

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const aspectRatio = 16 / 9;

  let pilotWidth = containerWidth;
  let pilotHeight = containerHeight; // pilotWidth / aspectRatio;

  // if (pilotHeight > containerHeight) {
  //   pilotHeight = containerHeight;
  //   pilotWidth = pilotHeight * aspectRatio;
  // }

  resizeCanvasToCssBox(pilotCanvas, pilotWidth, pilotHeight);

  // PiP views: 20% of container width, fixed aspect ratio.
  const pipWidth = containerWidth * 0.2;
  const pipHeight = pipWidth / aspectRatio;
  const pipMargin = 16;
  // Reserve vertical space so top PiP views sit below the HUD block.
  const hudTopInset = 130;

  // bottom-right (top view)
  topCanvas.style.right = `${pipMargin}px`;
  topCanvas.style.bottom = `${pipMargin}px`;
  resizeCanvasToCssBox(topCanvas, pipWidth, pipHeight);

  // bottom-left (rear view)
  rearCanvas.style.left = `${pipMargin}px`;
  rearCanvas.style.bottom = `${pipMargin}px`;
  resizeCanvasToCssBox(rearCanvas, pipWidth, pipHeight);

  // top-left (left view), leave room for HUD
  leftCanvas.style.left = `${pipMargin}px`;
  leftCanvas.style.top = `${hudTopInset + pipMargin}px`;
  resizeCanvasToCssBox(leftCanvas, pipWidth, pipHeight);

  // top-right (right view), leave room for HUD
  rightCanvas.style.right = `${pipMargin}px`;
  rightCanvas.style.top = `${hudTopInset + pipMargin}px`;
  resizeCanvasToCssBox(rightCanvas, pipWidth, pipHeight);
}

function updatePixelRatio(
  container: Element,
  pilotCanvas: HTMLCanvasElement,
  topCanvas: HTMLCanvasElement,
  leftCanvas: HTMLCanvasElement,
  rightCanvas: HTMLCanvasElement,
  rearCanvas: HTMLCanvasElement,
) {
  // Remove current DPR listener
  remove?.();

  resizeCanvases(
    container,
    pilotCanvas,
    topCanvas,
    leftCanvas,
    rightCanvas,
    rearCanvas,
  );

  // Add new DPR listener
  const mqString = `(resolution: ${window.devicePixelRatio}dppx)`;
  const media = matchMedia(mqString);
  const listener = () =>
    updatePixelRatio(
      container,
      pilotCanvas,
      topCanvas,
      leftCanvas,
      rightCanvas,
      rearCanvas,
    );
  media.addEventListener("change", listener);
  remove = () => {
    media.removeEventListener("change", listener);
  };
}
