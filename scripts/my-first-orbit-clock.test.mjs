import { afterEach, expect, it, vi } from "vitest";
import { startAnimationLoop } from "../packages/browser/src/infra/animationLoop";
import { createSession } from "../plugins/standalone-pack-v1/src/my-first-orbit/composition";

afterEach(() => vi.unstubAllGlobals());

it("replays the Chrome capture: Begin rebases a delayed callback, timestamp catch-up stays flying, and a real gap suspends", () => {
  let time = 0;
  let nextId = 0;
  const requests = new Map();
  vi.stubGlobal("performance", { now: () => time });
  vi.stubGlobal("requestAnimationFrame", (callback) => {
    requests.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id) => requests.delete(id));
  const c = createSession(2, "my-first-orbit", "es", () => true);
  const loop = startAnimationLoop(
    (now, dt) => {
      c.updateFrame(now, dt);
      c.observeStartupFrame(now, dt);
    },
    (error) => {
      throw error;
    },
  );
  const frame = (timestamp, callbackTime) => {
    const [id, callback] = requests.entries().next().value;
    requests.delete(id);
    time = callbackTime;
    callback(timestamp);
  };
  frame(38000, 38000);
  // Actual callback times and supplied frame timestamps from case10-03.log.
  frame(38142.2, 38372.5);
  frame(38358.8, 38510.3);
  frame(38508.8, 38639.3);
  frame(38625.4, 38825.6);
  frame(38825.3, 38959.6);
  expect(c.session.getPresentation().actions[0].disabled).toBe(false);
  c.session.command("begin");
  frame(38958.6, 39460.4);
  expect(c.session.phase).toBe("flying");
  expect(c.canAdvance()).toBe(false);
  frame(39458.4, 39462.2);
  expect(c.session.phase).toBe("flying");
  expect(c.canAdvance()).toBe(true);
  expect(c.objective.latestSequence).toBe(0);
  expect(c.objective.coastMillis).toBe(0);
  frame(39475.1, 39936.6);
  expect(c.session.phase).toBe("suspended");
  expect(c.canAdvance()).toBe(false);
  loop.dispose();
  expect(requests.size).toBe(0);
});
