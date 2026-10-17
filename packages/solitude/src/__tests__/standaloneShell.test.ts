import type {
  StandaloneEntrySession,
  StandaloneMode,
} from "@solitude/plugin-api/standalone-entry";
import { describe, expect, it, vi } from "vitest";
import { createStandaloneShell, type StandaloneRun } from "../standaloneShell";

function setup() {
  const deferred: (() => void)[] = [];
  const runs: (StandaloneRun & { notify: () => void; detached: () => void })[] =
    [];
  const order: string[] = [];
  const showRun = vi.fn(),
    showMenu = vi.fn(),
    showError = vi.fn(),
    resetUrl = vi.fn();
  let shouldFail = false;
  const shell = createStandaloneShell({
    createRun: (mode: StandaloneMode, generation: number) => {
      order.push(`create ${generation}`);
      if (shouldFail) throw new Error("startup");
      let listener = () => {};
      let oldListener = () => {};
      const session: StandaloneEntrySession = {
        mode,
        generation,
        phase: "briefing",
        advanceSimulation: false,
        lifecycleRequest: null,
        labels: {
          title: "",
          adventure: "",
          freeFlight: "",
          selectionError: "",
          startupError: "",
          menu: "",
          pause: "",
        },
        getPresentation: () => null,
        command: (command) => {
          if (command === "retry" || command === "menu")
            Object.assign(session, { lifecycleRequest: command });
          listener();
        },
        subscribe: (next) => {
          listener = next;
          oldListener = next;
          return () => {
            listener = () => {};
          };
        },
        attachInputReset: () => () => {},
      };
      const run = {
        session,
        guidance: null,
        clearInput: vi.fn(),
        dispose: vi.fn(() => {
          order.push(`dispose ${generation}`);
        }),
        notify: () => listener(),
        detached: () => oldListener(),
      };
      runs.push(run);
      return run;
    },
    showRun,
    hideRun: vi.fn(),
    showMenu,
    showError,
    resetUrl,
    defer: (callback) => deferred.push(callback),
  });
  return {
    shell,
    runs,
    order,
    showRun,
    showMenu,
    showError,
    resetUrl,
    failStartup: () => {
      shouldFail = true;
    },
    flush: () => {
      while (deferred.length) deferred.shift()!();
    },
  };
}
describe("standalone run ownership", () => {
  it("retries at a callback boundary, disposing before fresh construction with the same mode", () => {
    const s = setup();
    s.shell.launch("my-first-orbit");
    s.runs[0].session.command("retry");
    expect(s.runs).toHaveLength(1);
    s.flush();
    expect(s.order).toEqual(["create 1", "dispose 1", "create 2"]);
    expect(s.runs[1].session.mode).toBe("my-first-orbit");
    expect(s.runs[1].session.phase).toBe("briefing");
    expect(s.runs[1].clearInput).toHaveBeenCalledOnce();
    s.runs[0].detached();
    s.flush();
    expect(s.runs).toHaveLength(2);
  });
  it("returns to menu and ignores requests and failures from retired generations", () => {
    const s = setup();
    s.shell.launch("my-first-orbit");
    s.runs[0].session.command("retry");
    s.shell.menu();
    s.flush();
    expect(s.runs).toHaveLength(1);
    expect(s.resetUrl).toHaveBeenCalledOnce();
    s.shell.launch("free-flight");
    s.shell.fail(1, new Error("retired"));
    s.flush();
    expect(s.showError).not.toHaveBeenCalled();
    expect(s.runs[1].dispose).not.toHaveBeenCalled();
    s.runs[1].session.command("menu");
    s.flush();
    expect(s.showMenu).toHaveBeenCalledTimes(2);
  });
  it("cleans the active run on fatal failure and handles startup failure without reviving it", () => {
    const s = setup();
    s.shell.launch("my-first-orbit");
    s.shell.fail(1, new Error("renderer"));
    s.flush();
    expect(s.runs[0].dispose).toHaveBeenCalledOnce();
    s.failStartup();
    s.shell.launch("my-first-orbit");
    expect(s.showError).toHaveBeenCalledTimes(2);
    s.shell.dispose();
    s.shell.dispose();
    s.shell.launch("free-flight");
    expect(s.runs[0].dispose).toHaveBeenCalledOnce();
  });
});
