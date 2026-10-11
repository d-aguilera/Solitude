import type { WorldAndSceneConfig } from "@solitude/engine/world";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapWith } from "../../infra/domBootstrap";
import { createBrowserKeyboardHost } from "../../infra/domKeyboardInput";
import type { FrameGapTiming } from "../../infra/frameTiming";
import type { BrowserViewPresenterOptions } from "../../infra/viewPresenter";

const mocks = vi.hoisted(() => ({
  definitions: vi.fn(),
  pipeline: vi.fn(),
  layers: vi.fn(),
  presenter: vi.fn(),
}));
vi.mock("@solitude/engine/render", async (original) => ({
  ...(await original<typeof import("@solitude/engine/render")>()),
  buildViewDefinitions: mocks.definitions,
}));
vi.mock("@solitude/engine/runtime", async (original) => ({
  ...(await original<typeof import("@solitude/engine/runtime")>()),
  createConfiguredGamePipeline: mocks.pipeline,
}));
vi.mock("../../infra/domView", () => ({
  getOrCreateDomViewLayers: mocks.layers,
}));
vi.mock("../../infra/viewPresenter", () => ({
  createBrowserViewPresenter: mocks.presenter,
}));

describe("browser runtime lifetime", () => {
  let requests: Map<number, FrameRequestCallback>;
  let nextId: number;
  let windowTarget: EventTarget;
  let documentTarget: EventTarget;
  let removedElements: ReturnType<typeof vi.fn>[];
  let presenters: {
    dispose: ReturnType<typeof vi.fn>;
    renderInto: ReturnType<typeof vi.fn>;
    options: BrowserViewPresenterOptions;
  }[];
  let pipelines: {
    dispose: ReturnType<typeof vi.fn>;
    beginFrame: ReturnType<typeof vi.fn>;
    endFrame: ReturnType<typeof vi.fn>;
  }[];
  const config = {} as WorldAndSceneConfig;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("__solitudeRenderDebug", undefined);
    requests = new Map();
    nextId = 0;
    removedElements = [];
    presenters = [];
    pipelines = [];
    windowTarget = Object.assign(new EventTarget(), { devicePixelRatio: 1 });
    const container = { clientWidth: 1000, clientHeight: 700 };
    documentTarget = Object.assign(new EventTarget(), {
      visibilityState: "visible",
      querySelector: () => container,
    });
    vi.stubGlobal("window", windowTarget);
    vi.stubGlobal("document", documentTarget);
    vi.stubGlobal("matchMedia", () => new EventTarget());
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      requests.set(++nextId, callback);
      return nextId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => requests.delete(id));
    mocks.definitions.mockReturnValue([
      { id: "main", layout: { kind: "primary" } },
    ]);
    mocks.layers.mockImplementation(() => {
      const remove = vi.fn();
      removedElements.push(remove);
      return {
        element: { style: {}, remove },
        sceneCanvas: {},
        overlayCanvas: {},
      };
    });
    mocks.presenter.mockImplementation(
      (options: BrowserViewPresenterOptions) => {
        const presenter = {
          dispose: vi.fn(),
          renderInto: vi.fn(),
          resize: vi.fn(),
          options,
          surface: {},
          overlayRasterizer: null,
          sceneOverlayRasterizer: {
            clear: vi.fn(),
            drawMarkers: vi.fn(),
            drawSceneLabels: vi.fn(),
          },
        };
        presenters.push(presenter);
        return presenter;
      },
    );
    mocks.pipeline.mockImplementation(() => {
      const pipeline = {
        dispose: vi.fn(),
        beginFrame: vi.fn(() => ({
          framePolicy: { advancePresentation: true },
          simTimeMillis: 16,
        })),
        endFrame: vi.fn(),
        prepareView: vi.fn(),
        worldAndScene: { mainFocus: {}, world: {}, scene: {} },
        capabilityRegistry: { getAll: () => [] },
        views: mocks.definitions().map(() => ({ sceneView: { camera: {} } })),
      };
      pipelines.push(pipeline);
      return pipeline;
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  function frame(nowMs: number) {
    const [id, callback] = requests.entries().next().value!;
    requests.delete(id);
    callback(nowMs);
  }
  it("leaves timing off by default without reading the diagnostic clock", () => {
    const clock = vi.fn(() => 0);
    vi.stubGlobal("performance", { now: clock });
    const host = createBrowserKeyboardHost();
    const runtime = bootstrapWith(config, [], vi.fn(), host);
    frame(0);
    frame(16);
    frame(500);
    expect(clock).not.toHaveBeenCalled();
    expect(pipelines[0].beginFrame).toHaveBeenCalledTimes(2);
    runtime.dispose();
    host.dispose();
  });
  it("captures render stalls, keeps bounded snapshots across Retry, and preserves loop policy", () => {
    let time = 0;
    vi.stubGlobal("performance", { now: () => time });
    const debug = { timing: true, frameGaps: [] as FrameGapTiming[] };
    vi.stubGlobal("__solitudeRenderDebug", debug);
    const report = vi.spyOn(console, "info").mockImplementation(() => {});
    const host = createBrowserKeyboardHost();
    for (let generation = 0; generation < 5; generation++) {
      const runtime = bootstrapWith(config, [], vi.fn(), host);
      const pipeline = pipelines[generation];
      pipeline.beginFrame.mockImplementation(() => {
        time += 2;
        return {
          framePolicy: {
            advancePresentation: true,
            advanceSim: true,
            advanceScene: true,
          },
          simTimeMillis: 16,
        };
      });
      presenters[generation].renderInto.mockImplementation(() => {
        time += 400;
      });
      pipeline.endFrame.mockImplementation(() => {
        time += 4;
      });
      const base = generation * 1000;
      frame(base);
      time = base + 16;
      frame(base + 16);
      time = base + 433;
      frame(base + 433);
      expect(pipeline.beginFrame).toHaveBeenCalledTimes(2);
      expect(pipeline.endFrame).toHaveBeenCalledTimes(2);
      runtime.dispose();
    }
    expect(debug.frameGaps).toHaveLength(4);
    expect(debug.frameGaps[0]).toMatchObject({
      nowMs: 1433,
      dtMillis: 417,
      outsideCallbackMillis: 11,
      previousFrames: [
        {
          nowMs: 1016,
          pipelineMillis: 2,
          renderMillis: 400,
          afterFrameMillis: 4,
          advanceSim: true,
          advanceScene: true,
        },
      ],
    });
    expect(report).toHaveBeenCalledTimes(5);
    expect(typeof report.mock.calls[0][1]).toBe("string");
    expect(JSON.parse(report.mock.calls[0][1])).toMatchObject({
      nowMs: 433,
      previousFrames: [{ renderMillis: 400 }],
    });
    report.mockRestore();
    host.dispose();
  });
  it("supports repeated replacement without extra loops or listeners", () => {
    const host = createBrowserKeyboardHost();
    const removeWindow = vi.spyOn(windowTarget, "removeEventListener");
    const removeDocument = vi.spyOn(documentTarget, "removeEventListener");
    for (let i = 0; i < 3; i++) {
      const runtime = bootstrapWith(config, [], vi.fn(), host);
      expect(requests.size).toBe(1);
      frame(i * 100);
      frame(i * 100 + 16);
      runtime.dispose();
      runtime.dispose();
      expect(requests.size).toBe(0);
    }
    expect(pipelines.every((p) => p.dispose.mock.calls.length === 1)).toBe(
      true,
    );
    expect(presenters.every((p) => p.dispose.mock.calls.length === 1)).toBe(
      true,
    );
    expect(
      removedElements.every((remove) => remove.mock.calls.length === 1),
    ).toBe(true);
    expect(
      removeWindow.mock.calls.filter(([type]) => type === "resize"),
    ).toHaveLength(3);
    expect(
      removeWindow.mock.calls.filter(([type]) => type === "pagehide"),
    ).toHaveLength(3);
    host.dispose();
    expect(
      removeWindow.mock.calls.filter(([type]) => type === "keydown"),
    ).toHaveLength(1);
    expect(removeDocument).toHaveBeenCalledTimes(1);
  });
  it("stops during rendering and does not render another view or finish the frame", () => {
    mocks.definitions.mockReturnValue([
      { id: "main", layout: { kind: "primary" } },
      { id: "other", layout: { kind: "primary" } },
    ]);
    const host = createBrowserKeyboardHost();
    const runtime = bootstrapWith(config, [], vi.fn(), host);
    presenters[0].renderInto.mockImplementation(() => runtime.dispose());
    frame(0);
    frame(16);
    expect(presenters[1].renderInto).not.toHaveBeenCalled();
    expect(pipelines[0].endFrame).not.toHaveBeenCalled();
    expect(requests.size).toBe(0);
    host.dispose();
  });
  it("cleans a partially constructed set of views and permits a fresh launch", () => {
    mocks.definitions.mockReturnValue([
      { id: "main", layout: { kind: "primary" } },
      { id: "other", layout: { kind: "primary" } },
    ]);
    const normal = mocks.presenter.getMockImplementation()!;
    mocks.presenter
      .mockImplementationOnce(normal)
      .mockImplementationOnce(() => {
        throw new Error("presenter failed");
      });
    const host = createBrowserKeyboardHost();
    expect(() => bootstrapWith(config, [], vi.fn(), host)).toThrow(
      "presenter failed",
    );
    expect(presenters[0].dispose).toHaveBeenCalledTimes(1);
    expect(
      removedElements.every((remove) => remove.mock.calls.length === 1),
    ).toBe(true);
    expect(requests.size).toBe(0);
    const fresh = bootstrapWith(config, [], vi.fn(), host);
    fresh.dispose();
    host.dispose();
  });
  it("cleans listeners and presenters when pipeline startup fails", () => {
    const host = createBrowserKeyboardHost();
    const removeWindow = vi.spyOn(windowTarget, "removeEventListener");
    mocks.pipeline.mockImplementationOnce(() => {
      throw new Error("pipeline failed");
    });
    expect(() => bootstrapWith(config, [], vi.fn(), host)).toThrow(
      "pipeline failed",
    );
    expect(presenters[0].dispose).toHaveBeenCalledTimes(1);
    expect(removeWindow.mock.calls.map(([type]) => type)).toEqual([
      "pagehide",
      "resize",
    ]);
    const fresh = bootstrapWith(config, [], vi.fn(), host);
    fresh.dispose();
    host.dispose();
  });
  it("stops on fatal render failure and ignores retired view notifications", () => {
    const host = createBrowserKeyboardHost();
    const report = vi.fn();
    const runtime = bootstrapWith(config, [], report, host);
    presenters[0].options.onFatalError({
      code: "webgl-context-lost",
      cause: null,
    });
    expect(requests.size).toBe(0);
    expect(report).toHaveBeenCalledTimes(1);
    runtime.dispose();
    const fresh = bootstrapWith(config, [], vi.fn(), host);
    presenters[0].options.onFatalError({
      code: "webgl-context-lost",
      cause: null,
    });
    expect(report).toHaveBeenCalledTimes(1);
    expect(requests.size).toBe(1);
    fresh.dispose();
    host.dispose();
  });
  it("disposes on pagehide and frame exceptions", () => {
    const host = createBrowserKeyboardHost();
    bootstrapWith(config, [], vi.fn(), host);
    presenters[0].renderInto.mockImplementation(() => {
      throw new Error("render failed");
    });
    frame(0);
    expect(() => frame(16)).toThrow("render failed");
    expect(requests.size).toBe(0);
    expect(pipelines[0].dispose).toHaveBeenCalledTimes(1);
    bootstrapWith(config, [], vi.fn(), host);
    windowTarget.dispatchEvent(new Event("pagehide"));
    expect(requests.size).toBe(0);
    expect(pipelines[1].dispose).toHaveBeenCalledTimes(1);
  });
});
