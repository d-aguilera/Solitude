import type {
  AdventureGuidance,
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
  let active: StandaloneSession | null = null;
  let activeGuidance: AdventureGuidance | null = null;
  let phase: StandaloneSession["phase"] | null = null;
  let unsubscribe = () => {};
  let updateGuidance = () => {};
  let updateActions = () => {};
  let disposed = false;
  const clearRun = () => {
    active = null;
    activeGuidance = null;
    phase = null;
    unsubscribe();
    unsubscribe = () => {};
    updateGuidance = () => {};
    updateActions = () => {};
    root.replaceChildren();
  };
  const button = (label: string, command: () => void, disabled = false) => {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.disabled = disabled;
    element.addEventListener("click", () => {
      if (!disposed) command();
    });
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
    return { section, actions };
  };
  const focusFirst = () =>
    root.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  const setText = (element: HTMLElement, text: string) => {
    if (element.textContent !== text) element.textContent = text;
  };
  const connectGuidance = (
    session: StandaloneSession,
    guidance: AdventureGuidance,
    host: HTMLElement,
    flight: boolean,
  ) => {
    const current = () =>
      active === session &&
      activeGuidance === guidance &&
      guidance.generation === session.generation &&
      !session.lifecycleRequest &&
      !disposed;
    const hint = document.createElement("p");
    hint.id = `adventure-hint-${session.generation}-${session.phase}`;
    const toggle = button(guidance.hintToggleLabel, () => {
      if (current())
        guidance.setHintsEnabled(session.generation, !guidance.hintsEnabled);
    });
    toggle.setAttribute("aria-controls", hint.id);
    let refreshFlight = () => {};
    if (flight) {
      host.className = "standalone-flight-panel";
      // The objective names this region using pack-owned localized prose.
      host.setAttribute("aria-label", guidance.objectiveText);
      const objective = document.createElement("p");
      objective.textContent = guidance.objectiveText;
      const cue = document.createElement("p");
      cue.className = "adventure-cue";
      cue.setAttribute("aria-live", "polite");
      cue.setAttribute("aria-atomic", "true");
      const warning = document.createElement("p");
      warning.className = "adventure-warning";
      const acknowledgment = document.createElement("p");
      const instruments = document.createElement("dl");
      const slots = guidance.instruments.map((instrument) => {
        const row = document.createElement("div");
        row.setAttribute("data-instrument", instrument.id);
        const label = document.createElement("dt");
        const value = document.createElement("dd");
        row.append(label, value);
        instruments.append(row);
        return { instrument, row, label, value };
      });
      host.append(objective, cue, warning, acknowledgment, instruments);
      refreshFlight = () => {
        host.hidden =
          session.phase !== "flying" || session.lifecycleRequest !== null;
        // Only changed primary cues enter the live region; numeric updates do not.
        setText(cue, guidance.cueText);
        setText(warning, guidance.warningText);
        warning.hidden = !guidance.warningText;
        setText(acknowledgment, guidance.acknowledgmentText);
        acknowledgment.hidden = !guidance.acknowledgmentText;
        for (const { instrument, row, label, value } of slots) {
          row.className = instrument.emphasized ? "adventure-emphasized" : "";
          setText(
            label,
            `${instrument.emphasized ? "▶ " : ""}${instrument.label}`,
          );
          setText(value, instrument.text);
        }
      };
    }
    host.append(toggle, hint);
    updateGuidance = () => {
      if (
        active !== session ||
        activeGuidance !== guidance ||
        disposed ||
        guidance.generation !== session.generation
      )
        return;
      refreshFlight();
      setText(toggle, guidance.hintToggleLabel);
      toggle.setAttribute("aria-expanded", String(guidance.hintsEnabled));
      setText(hint, guidance.hintText);
      hint.hidden = !guidance.hintsEnabled || !guidance.hintText;
    };
    const refresh = updateGuidance;
    unsubscribe = guidance.subscribe(refresh);
    refresh();
  };
  return {
    clearRun,
    showMenu: () => {
      if (disposed) return;
      clearRun();
      const { actions } = panel(labels.title, "");
      actions.append(
        button(labels.adventure, () => launch("my-first-orbit")),
        button(labels.freeFlight, () => launch("free-flight")),
      );
      focusFirst();
    },
    showError: (body: string) => {
      if (disposed) return;
      clearRun();
      panel(labels.title, body).actions.append(button(labels.menu, menu));
      focusFirst();
    },
    showRun: (
      session: StandaloneSession,
      guidance: AdventureGuidance | null,
    ) => {
      if (disposed) return;
      if (
        active === session &&
        activeGuidance === guidance &&
        phase === session.phase
      ) {
        updateActions();
        updateGuidance();
        return;
      }
      clearRun();
      active = session;
      activeGuidance = guidance;
      phase = session.phase;
      const command = (action: Parameters<StandaloneSession["command"]>[0]) => {
        if (active === session && !session.lifecycleRequest)
          session.command(action);
      };
      const presentation = session.getPresentation();
      if (presentation) {
        const { section, actions } = panel(
          presentation.title,
          presentation.body,
        );
        const actionButtons = presentation.actions.map((action) => {
          const element = button(
            action.label,
            () => command(action.command),
            action.disabled,
          );
          actions.append(element);
          return element;
        });
        updateActions = () => {
          const current = session.getPresentation();
          if (!current) return;
          for (let i = 0; i < actionButtons.length; i++) {
            actionButtons[i].disabled = current.actions[i].disabled;
            setText(actionButtons[i], current.actions[i].label);
          }
        };
        if (
          guidance &&
          (session.phase === "paused" || session.phase === "suspended")
        )
          connectGuidance(session, guidance, section, false);
        focusFirst();
      } else {
        const toolbar = document.createElement("div");
        toolbar.className = "standalone-toolbar";
        if (session.mode === "my-first-orbit") {
          toolbar.append(button(labels.pause, () => command("pause")));
          if (guidance) {
            const flight = document.createElement("section");
            root.append(flight);
            connectGuidance(session, guidance, flight, true);
          }
        }
        toolbar.append(button(labels.menu, () => command("menu")));
        root.append(toolbar);
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearRun();
      root.remove();
    },
  };
}
