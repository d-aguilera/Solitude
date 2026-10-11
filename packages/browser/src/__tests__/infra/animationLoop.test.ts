import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startAnimationLoop } from "../../infra/animationLoop";

describe("animation loop lifetime", () => {
  let requests: Map<number, FrameRequestCallback>;
  let nextId: number;
  let callbackNow: number;
  beforeEach(() => {
    requests = new Map();
    nextId = 0;
    callbackNow = 0;
    vi.stubGlobal("performance", { now: () => callbackNow });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      requests.set(++nextId, callback);
      return nextId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => requests.delete(id));
  });
  afterEach(() => vi.unstubAllGlobals());
  function frame(nowMs: number, actualNowMs = nowMs) {
    callbackNow = actualNowMs;
    const [id, callback] = requests.entries().next().value!;
    requests.delete(id);
    callback(nowMs);
  }
  it("uses actual callback time when captured frame timestamps lag and catch up", () => {
    const update = vi.fn();
    const loop = startAnimationLoop(update, vi.fn());
    frame(38825.3, 38959.6);
    frame(38958.6, 39460.4);
    frame(39458.4, 39462.2);
    expect(update.mock.calls[0][0]).toBe(39460.4);
    expect(update.mock.calls[0][1]).toBeCloseTo(500.8);
    expect(update.mock.calls[1][0]).toBe(39462.2);
    expect(update.mock.calls[1][1]).toBeCloseTo(1.8);
    loop.dispose();
  });
  it("preserves real callback gaps even when supplied timestamps barely advance", () => {
    const update = vi.fn();
    const loop = startAnimationLoop(update, vi.fn());
    frame(0, 0);
    frame(16, 500);
    expect(update).toHaveBeenCalledWith(500, 500, expect.anything());
    loop.dispose();
  });
  it("rebases the first frame and cancels an outstanding callback", () => {
    const update = vi.fn();
    const loop = startAnimationLoop(update, (error) => {
      throw error;
    });
    frame(1000);
    expect(update).not.toHaveBeenCalled();
    frame(1016);
    expect(update).toHaveBeenCalledWith(
      1016,
      16,
      expect.objectContaining({ running: true }),
    );
    const stale = requests.values().next().value!;
    loop.dispose();
    loop.dispose();
    expect(requests.size).toBe(0);
    stale(1032);
    expect(update).toHaveBeenCalledTimes(1);
  });
  it("does not reschedule when disposed inside its callback", () => {
    const loop = startAnimationLoop(
      (_now, _dt, state) => {
        loop.dispose();
        expect(state.running).toBe(false);
      },
      (error) => {
        throw error;
      },
    );
    frame(0);
    frame(16);
    expect(requests.size).toBe(0);
  });
  it("stops before reporting an error, permitting a fresh loop", () => {
    const error = new Error("render failed");
    const report = vi.fn(() => expect(requests.size).toBe(0));
    startAnimationLoop(() => {
      throw error;
    }, report);
    frame(0);
    frame(16);
    expect(report).toHaveBeenCalledWith(error);
    const fresh = startAnimationLoop(vi.fn(), report);
    expect(requests.size).toBe(1);
    fresh.dispose();
    expect(requests.size).toBe(0);
  });
});
