import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startAnimationLoop } from "../../infra/animationLoop";

describe("animation loop lifetime", () => {
  let requests: Map<number, FrameRequestCallback>;
  let nextId: number;
  beforeEach(() => {
    requests = new Map();
    nextId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      requests.set(++nextId, callback);
      return nextId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => requests.delete(id));
  });
  afterEach(() => vi.unstubAllGlobals());
  function frame(nowMs: number) {
    const [id, callback] = requests.entries().next().value!;
    requests.delete(id);
    callback(nowMs);
  }
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
