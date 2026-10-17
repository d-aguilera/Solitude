import type { AdventureGuidance } from "@solitude/plugin-api/my-first-orbit";
import type { StandaloneEntrySession } from "@solitude/plugin-api/standalone-entry";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStandalonePresentation } from "../standalonePresentation";

// Small DOM adapter: exercises retained nodes, event callbacks, focus and teardown.
class Node {
  children: Node[] = [];
  parent: Node | null = null;
  className = "";
  id = "";
  textContent = "";
  hidden = false;
  disabled = false;
  type = "";
  attributes = new Map<string, string>();
  click = () => {};
  constructor(readonly tag: string) {}
  append(...nodes: Node[]) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  replaceChildren() {
    for (const child of this.children) child.parent = null;
    this.children = [];
  }
  remove() {
    if (this.parent)
      this.parent.children = this.parent.children.filter(
        (node) => node !== this,
      );
    this.parent = null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  addEventListener(_name: string, callback: () => void) {
    this.click = callback;
  }
  focus() {
    focused = this;
  }
  all(): Node[] {
    return [this, ...this.children.flatMap((node) => node.all())];
  }
  querySelector() {
    return this.all().find((node) => node.tag === "button" && !node.disabled);
  }
}
let focused: Node | null = null;
afterEach(() => {
  vi.unstubAllGlobals();
  focused = null;
});
function setup() {
  vi.stubGlobal("document", { createElement: (tag: string) => new Node(tag) });
  const container = new Node("main");
  const labels = {
    title: "Solitude",
    adventure: "My First Orbit",
    freeFlight: "Free Flight",
    selectionError: "Selection error",
    startupError: "Startup error",
    menu: "Menu",
    pause: "Pause",
  };
  const session: StandaloneEntrySession = {
    generation: 1,
    mode: "my-first-orbit",
    phase: "flying",
    advanceSimulation: true,
    lifecycleRequest: null,
    labels,
    command: vi.fn(),
    subscribe: () => () => {},
    attachInputReset: () => () => {},
    getPresentation: () =>
      session.phase === "flying"
        ? null
        : {
            title: session.phase,
            body: "Flight is stopped",
            actions: [{ command: "resume", label: "Resume", disabled: false }],
          },
  };
  const listeners = new Set<() => void>();
  const retired: (() => void)[] = [];
  const instrument = {
    id: "adventure.orbit.periapsisAltitude" as const,
    label: "Lowest point above Earth (≥150 km)",
    value: -50_000,
    unit: "m" as const,
    text: "-50 km",
    emphasized: true,
  };
  const guidance: AdventureGuidance = {
    generation: 1,
    revision: 0,
    visible: true,
    cue: "recover",
    cueText: "Hold Space",
    warningText: "Predicted path intersects Earth",
    acknowledgmentText: "",
    objectiveText: "Lowest ≥150 km, highest ≤600 km; coast five seconds",
    hintText: "Forward thrust raises the lowest point",
    hintsEnabled: false,
    hintToggleLabel: "Show hints",
    instruments: [instrument],
    setHintsEnabled: vi.fn((generation, enabled) => {
      expect(generation).toBe(guidance.generation);
      Object.assign(guidance, {
        hintsEnabled: enabled,
        hintToggleLabel: enabled ? "Hide hints" : "Show hints",
      });
      notify();
    }),
    subscribe: (listener) => {
      listeners.add(listener);
      retired.push(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const ui = createStandalonePresentation(
    container as unknown as Element,
    labels,
    vi.fn(),
    vi.fn(),
  );
  const find = (predicate: (node: Node) => boolean) =>
    container.all().find(predicate)!;
  const byText = (text: string) => find((node) => node.textContent === text);
  return {
    ui,
    session,
    guidance,
    instrument,
    container,
    find,
    byText,
    notify,
    listeners,
    retired,
  };
}
describe("standalone adventure presentation", () => {
  it("keeps guidance before the first sample and hides immediately on retry", () => {
    const s = setup();
    Object.assign(s.guidance, { visible: false, cueText: "", warningText: "" });
    s.instrument.text = "Awaiting flight data";
    s.ui.showRun(s.session, s.guidance);
    const flight = s.find(
      (node) => node.className === "standalone-flight-panel",
    );
    expect(flight.hidden).toBe(false);
    expect(
      s.container.all().some((node) => node.attributes.has("data-instrument")),
    ).toBe(false);
    Object.assign(s.session, { lifecycleRequest: "retry" });
    s.notify();
    expect(flight.hidden).toBe(true);
  });
  it("leaves instruments to the HUD and retains guidance nodes and focus on updates", () => {
    const s = setup();
    s.ui.showRun(s.session, s.guidance);
    expect(
      s.container.all().some((node) => node.attributes.has("data-instrument")),
    ).toBe(false);
    const value = s.byText("-50 km");
    const cue = s.byText("Hold Space");
    expect(cue.attributes.get("aria-live")).toBe("polite");
    const toggle = s.byText("Show hints");
    toggle.focus();
    toggle.click();
    expect(toggle.textContent).toBe("Hide hints");
    expect(toggle.attributes.get("aria-expanded")).toBe("true");
    expect(s.byText(s.guidance.hintText).hidden).toBe(false);
    s.instrument.text = "150 km";
    s.notify();
    s.ui.showRun(s.session, s.guidance);
    expect(s.byText("150 km")).toBe(value);
    expect(
      s.find((node) => node.className === "standalone-hud-accessibility"),
    ).toBeDefined();
    expect(s.byText("Hold Space")).toBe(cue);
    expect(focused).toBe(toggle);
    expect(s.listeners.size).toBe(1);
    toggle.click();
    expect(s.byText(s.guidance.hintText).hidden).toBe(true);
    expect(s.session.command).not.toHaveBeenCalled();
  });
  it("provides pause and suspension hint controls without resuming or changing flight", () => {
    const s = setup();
    s.ui.showRun(s.session, s.guidance);
    for (const phase of ["paused", "suspended"] as const) {
      Object.assign(s.session, { phase });
      Object.assign(s.guidance, { visible: false });
      s.ui.showRun(s.session, s.guidance);
      expect(
        s.container
          .all()
          .some((node) => node.attributes.has("data-instrument")),
      ).toBe(false);
      const toggle = s.byText(s.guidance.hintToggleLabel);
      toggle.focus();
      toggle.click();
      expect(focused).toBe(toggle);
      expect(s.session.command).not.toHaveBeenCalled();
      expect(s.listeners.size).toBe(1);
    }
  });
  it("refreshes lifecycle action availability in the same phase without replacing focused buttons", () => {
    const s = setup();
    let disabled = true;
    let beginLabel = "Preparing flight…";
    Object.assign(s.session, {
      phase: "briefing",
      getPresentation: () => ({
        title: "Briefing",
        body: "",
        actions: [
          { command: "begin", label: beginLabel, disabled },
          { command: "menu", label: "Menu", disabled: false },
        ],
      }),
    });
    s.ui.showRun(s.session, s.guidance);
    const begin = s.byText("Preparing flight…");
    const menu = s.byText("Menu");
    expect(begin.disabled).toBe(true);
    expect(begin.textContent).toBe("Preparing flight…");
    expect(focused).toBe(menu);
    disabled = false;
    beginLabel = "Begin";
    s.ui.showRun(s.session, s.guidance);
    expect(s.byText("Begin")).toBe(begin);
    expect(begin.disabled).toBe(false);
    expect(begin.textContent).toBe("Begin");
    expect(focused).toBe(menu);
  });
  it("hides flight guidance synchronously and retires subscriptions and saved callbacks", () => {
    const s = setup();
    s.ui.showRun(s.session, s.guidance);
    const toggle = s.byText("Show hints");
    const pause = s.byText("Pause");
    const flight = s.find(
      (node) => node.className === "standalone-flight-panel",
    );
    Object.assign(s.session, { phase: "completed" });
    Object.assign(s.guidance, { visible: false, cueText: "" });
    s.notify();
    expect(flight.hidden).toBe(true);
    s.ui.clearRun();
    expect(s.listeners.size).toBe(0);
    const next = { ...s.session, generation: 2, phase: "flying" as const };
    const nextGuidance = { ...s.guidance, generation: 2, visible: true };
    s.ui.showRun(next, nextGuidance);
    const nodes = s.container.all();
    toggle.click();
    pause.click();
    s.retired[0]();
    expect(s.container.all()).toEqual(nodes);
    expect(s.guidance.setHintsEnabled).not.toHaveBeenCalled();
    expect(s.session.command).not.toHaveBeenCalled();
    s.ui.showMenu();
    expect(s.listeners.size).toBe(0);
    expect(s.byText("My First Orbit")).toBeDefined();
    s.ui.dispose();
    s.ui.dispose();
    expect(s.container.children).toHaveLength(0);
    s.ui.showRun(s.session, s.guidance);
    expect(s.listeners.size).toBe(0);
  });
  it("renders no guidance for Free Flight or terminal phases, and blocks pending lifecycle callbacks", () => {
    const s = setup();
    s.ui.showRun(s.session, s.guidance);
    const toggle = s.byText("Show hints");
    Object.assign(s.session, { lifecycleRequest: "retry" });
    toggle.click();
    expect(s.guidance.setHintsEnabled).not.toHaveBeenCalled();
    Object.assign(s.session, { phase: "completed", lifecycleRequest: null });
    s.ui.showRun(s.session, s.guidance);
    expect(s.listeners.size).toBe(0);
    expect(
      s.container.all().some((node) => node.textContent === "Show hints"),
    ).toBe(false);
    s.ui.showRun(
      {
        ...s.session,
        mode: "free-flight",
        phase: "flying",
        getPresentation: () => null,
      },
      null,
    );
    expect(
      s.container
        .all()
        .some((node) => node.className === "standalone-flight-panel"),
    ).toBe(false);
    expect(s.byText("Menu")).toBeDefined();
  });
});
