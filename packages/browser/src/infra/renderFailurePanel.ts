export interface RenderFailurePanelOptions {
  container: Element;
  message: string;
  title: string;
}

export function showRenderFailurePanel({
  container,
  message,
  title,
}: RenderFailurePanelOptions): void {
  container.replaceChildren();
  const panel = document.createElement("section");
  panel.setAttribute("role", "alert");
  panel.style.position = "absolute";
  panel.style.inset = "0";
  panel.style.display = "grid";
  panel.style.placeContent = "center";
  panel.style.gap = "12px";
  panel.style.padding = "24px";
  panel.style.color = "white";
  panel.style.background = "#080b0a";
  panel.style.font = "16px system-ui, sans-serif";
  panel.style.textAlign = "center";

  const heading = document.createElement("h1");
  heading.textContent = title;
  const detail = document.createElement("p");
  detail.textContent = message;
  panel.append(heading, detail);
  container.appendChild(panel);
}
