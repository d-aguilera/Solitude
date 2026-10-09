import type {
  StandaloneMode,
  StandaloneSession,
} from "@solitude/plugin-api/standalone-session";

export function createStandalonePresentation(
  container: Element,
  labels: StandaloneSession["labels"],
  launch: (mode: StandaloneMode) => void,
  menu: () => void,
) {
  const root = document.createElement("div");
  root.className = "standalone-ui";
  container.append(root);
  const button = (label: string, command: () => void, disabled = false) => {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.disabled = disabled;
    element.addEventListener("click", command);
    return element;
  };
  const panel = (title: string, body: string) => {
    root.replaceChildren();
    const section = document.createElement("section");
    section.className = "standalone-panel";
    section.setAttribute("aria-label", title);
    const heading = document.createElement("h1");
    heading.textContent = title;
    section.append(heading);
    if (body) {
      const p = document.createElement("p");
      p.textContent = body;
      section.append(p);
    }
    const actions = document.createElement("div");
    actions.className = "standalone-actions";
    section.append(actions);
    root.append(section);
    return actions;
  };
  const focusFirst = () =>
    root.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  return {
    showMenu: () => {
      const actions = panel(labels.title, "");
      actions.append(
        button(labels.adventure, () => launch("my-first-orbit")),
        button(labels.freeFlight, () => launch("free-flight")),
      );
      focusFirst();
    },
    showError: (body: string) => {
      panel(labels.title, body).append(button(labels.menu, menu));
      focusFirst();
    },
    showRun: (session: StandaloneSession) => {
      const presentation = session.getPresentation();
      if (presentation) {
        const actions = panel(presentation.title, presentation.body);
        for (const action of presentation.actions)
          actions.append(
            button(
              action.label,
              () => session.command(action.command),
              action.disabled,
            ),
          );
        focusFirst();
      } else {
        root.replaceChildren();
        const toolbar = document.createElement("div");
        toolbar.className = "standalone-toolbar";
        if (session.mode === "my-first-orbit")
          toolbar.append(button(labels.pause, () => session.command("pause")));
        toolbar.append(button(labels.menu, () => session.command("menu")));
        root.append(toolbar);
      }
    },
    dispose: () => root.remove(),
  };
}
