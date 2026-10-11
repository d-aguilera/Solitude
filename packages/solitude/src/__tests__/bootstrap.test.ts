import { bootstrapRendering } from "@solitude/browser/dom/renderingBootstrap";
import type { GamePlugin } from "@solitude/engine/plugin";
import {
  standaloneGenerationOption,
  standaloneModeOption,
  standaloneSessionCapability,
  type StandaloneSession,
} from "@solitude/plugin-api/standalone-session";
import { loadBrowserPlugins } from "@solitude/plugin-runtime";
import { afterEach, expect, it, vi } from "vitest";
import { createStandalonePresentation } from "../standalonePresentation";

vi.mock("@solitude/browser/dom/keyboardInput", () => ({
  createBrowserKeyboardHost: () => ({ dispose: vi.fn() }),
}));
vi.mock("@solitude/browser/dom/renderingBootstrap", () => ({
  bootstrapRendering: vi.fn(),
}));
vi.mock("@solitude/plugin-runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@solitude/plugin-runtime")>()),
  loadBrowserPlugins: vi.fn(),
}));
vi.mock("../staticPluginCatalog", () => ({
  staticPluginCatalog: {},
  staticPluginIds: [],
}));
vi.mock("../standalonePresentation", () => ({
  createStandalonePresentation: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.resetModules();
});

it("defers menu, retry, and fatal-error retirement with the browser scheduler receiver", async () => {
  const pending: (() => void)[] = [];
  const browserWindow = {
    location: {
      search: "?mode=free-flight&locale=es",
      href: "https://solitude.test/?mode=free-flight&locale=es",
    },
    history: { replaceState: vi.fn() },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    queueMicrotask(this: unknown, callback: () => void) {
      // Browsers reject host-method calls with dependencies as their receiver.
      if (this !== browserWindow) throw new TypeError("Illegal invocation");
      pending.push(callback);
    },
  };
  vi.stubGlobal("window", browserWindow);
  vi.stubGlobal("queueMicrotask", browserWindow.queueMicrotask);
  vi.stubGlobal("navigator", { languages: ["es"] });
  vi.stubGlobal("document", {
    baseURI: "https://solitude.test/",
    querySelector: () => ({}),
  });
  const presentation = {
    showRun: vi.fn(),
    clearRun: vi.fn(),
    showMenu: vi.fn(),
    showError: vi.fn(),
    dispose: vi.fn(),
  };
  vi.mocked(createStandalonePresentation).mockReturnValue(presentation);
  const dispose = vi.fn();
  vi.mocked(bootstrapRendering).mockReturnValue({
    clearInput: vi.fn(),
    dispose,
  });
  vi.mocked(loadBrowserPlugins).mockResolvedValue({
    ids: ["standaloneSession"],
    catalog: {
      standaloneSession: (options): GamePlugin => {
        let listener = () => {};
        const session: StandaloneSession = {
          generation: Number(options[standaloneGenerationOption]),
          mode: options[standaloneModeOption] as StandaloneSession["mode"],
          phase: "flying",
          advanceSimulation: true,
          lifecycleRequest: null,
          labels: {
            title: "Solitude",
            adventure: "Mi primera órbita",
            freeFlight: "Vuelo libre",
            selectionError: "Selección inválida",
            startupError: "Error al iniciar",
            menu: "Volver al menú",
            pause: "Pausa",
          },
          command: (command) => {
            if (command === "menu" || command === "retry")
              Object.assign(session, { lifecycleRequest: command });
            listener();
          },
          subscribe: (next) => {
            listener = next;
            return () => {
              listener = () => {};
            };
          },
          attachInputReset: () => () => {},
          getPresentation: () => null,
        };
        return {
          id: "standaloneSession",
          capabilities: [{ id: standaloneSessionCapability, value: session }],
        };
      },
    },
  });
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await import("../bootstrap");
    await vi.waitFor(() => expect(presentation.showRun).toHaveBeenCalledOnce());
    const first = presentation.showRun.mock.calls[0][0] as StandaloneSession;
    first.command("retry");
    expect(dispose).not.toHaveBeenCalled();
    pending.shift()!();
    expect(dispose).toHaveBeenCalledOnce();
    const second = presentation.showRun.mock.calls[1][0] as StandaloneSession;
    expect(second.generation).toBe(first.generation + 1);
    second.command("menu");
    pending.shift()!();
    expect(presentation.showMenu).toHaveBeenCalledOnce();
    expect(browserWindow.history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "https://solitude.test/?locale=es",
    );
    const launch = vi.mocked(createStandalonePresentation).mock.calls[0][2];
    launch("free-flight");
    vi.mocked(bootstrapRendering).mock.calls[2][0].onFatalError!({
      code: "webgl-context-lost",
      cause: null,
    });
    pending.shift()!();
    expect(dispose).toHaveBeenCalledTimes(3);
    expect(presentation.showError).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledOnce();
  } finally {
    consoleError.mockRestore();
  }
});
