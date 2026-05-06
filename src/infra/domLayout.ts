import type { ViewLayout } from "../app/viewPorts";

let remove: (() => void) | null = null;

export interface LayoutView {
  canvas: HTMLCanvasElement;
  layout: ViewLayout;
}

export function initLayout(container: Element, views: LayoutView[]) {
  updatePixelRatio(container, views);

  window.addEventListener("resize", () => {
    resizeCanvases(container, views);
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

function resizeCanvases(container: Element, views: LayoutView[]): void {
  if (!container) return;

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const aspectRatio = 16 / 9;

  let primaryWidth = containerWidth;
  let primaryHeight = containerHeight; // primaryWidth / aspectRatio;

  // if (primaryHeight > containerHeight) {
  //   primaryHeight = containerHeight;
  //   primaryWidth = primaryHeight * aspectRatio;
  // }

  const primaryView = views.find((view) => view.layout.kind === "primary");
  if (primaryView) {
    primaryView.canvas.style.left = "0";
    primaryView.canvas.style.right = "auto";
    primaryView.canvas.style.top = "0";
    primaryView.canvas.style.bottom = "auto";
    resizeCanvasToCssBox(primaryView.canvas, primaryWidth, primaryHeight);
  }

  // PiP views: 20% of container width, fixed aspect ratio.
  const pipWidth = containerWidth * 0.2;
  const pipHeight = pipWidth / aspectRatio;
  const pipMargin = 16;
  // Reserve vertical space so top PiP views sit below the HUD block.
  const hudTopInset = 130;

  for (const view of views) {
    if (view.layout.kind !== "pip") continue;
    const canvas = view.canvas;
    const layout = view.layout;
    canvas.style.left = "auto";
    canvas.style.right = "auto";
    canvas.style.top = "auto";
    canvas.style.bottom = "auto";

    const verticalInset =
      layout.vertical === "top" && layout.avoidHud
        ? hudTopInset + pipMargin
        : pipMargin;

    if (layout.horizontal === "left") {
      canvas.style.left = `${pipMargin}px`;
    } else {
      canvas.style.right = `${pipMargin}px`;
    }

    if (layout.vertical === "top") {
      canvas.style.top = `${verticalInset}px`;
    } else {
      canvas.style.bottom = `${verticalInset}px`;
    }

    resizeCanvasToCssBox(canvas, pipWidth, pipHeight);
  }
}

function updatePixelRatio(container: Element, views: LayoutView[]) {
  // Remove current DPR listener
  remove?.();

  resizeCanvases(container, views);

  // Add new DPR listener
  const mqString = `(resolution: ${window.devicePixelRatio}dppx)`;
  const media = matchMedia(mqString);
  const listener = () => updatePixelRatio(container, views);
  media.addEventListener("change", listener);
  remove = () => {
    media.removeEventListener("change", listener);
  };
}
