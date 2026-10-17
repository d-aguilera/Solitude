import type { AdventureGuidance } from "@solitude/plugin-api/my-first-orbit";
import type {
  StandaloneEntrySession,
  StandaloneMode,
} from "@solitude/plugin-api/standalone-entry";

export interface StandaloneRun {
  session: StandaloneEntrySession;
  guidance: AdventureGuidance | null;
  clearInput: () => void;
  dispose: () => void;
}
export function createStandaloneShell(dependencies: {
  createRun: (mode: StandaloneMode, generation: number) => StandaloneRun;
  showRun: (
    session: StandaloneEntrySession,
    guidance: AdventureGuidance | null,
  ) => void;
  hideRun: () => void;
  showMenu: () => void;
  showError: (error: unknown) => void;
  resetUrl: () => void;
  defer: (callback: () => void) => void;
}) {
  let generation = 0;
  let active: StandaloneRun | null = null;
  let detach = () => {};
  let disposed = false;
  const retire = () => {
    const old = active;
    active = null;
    detach();
    detach = () => {};
    dependencies.hideRun();
    old?.dispose();
  };
  const menu = () => {
    if (disposed) return;
    ++generation;
    retire();
    dependencies.resetUrl();
    dependencies.showMenu();
  };
  const launch = (mode: StandaloneMode) => {
    if (disposed) return;
    const runGeneration = ++generation;
    retire();
    try {
      const run = dependencies.createRun(mode, runGeneration);
      if (disposed || runGeneration !== generation) {
        run.dispose();
        return;
      }
      active = run;
      if (run.session.generation !== runGeneration || run.session.mode !== mode)
        throw new Error("Invalid standalone session identity");
      const resetDetach = run.session.attachInputReset(run.clearInput);
      const unsubscribe = run.session.subscribe(() => {
        if (active !== run || generation !== runGeneration) return;
        if (run.session.lifecycleRequest) {
          dependencies.defer(() => {
            if (active !== run || generation !== runGeneration) return;
            if (run.session.lifecycleRequest === "retry") launch(mode);
            else menu();
          });
        } else dependencies.showRun(run.session, run.guidance);
      });
      detach = () => {
        unsubscribe();
        resetDetach();
      };
      run.clearInput();
      dependencies.showRun(run.session, run.guidance);
    } catch (error) {
      if (runGeneration !== generation || disposed) return;
      ++generation;
      retire();
      dependencies.showError(error);
    }
  };
  return {
    launch,
    menu,
    fail: (failedGeneration: number, error: unknown) => {
      dependencies.defer(() => {
        if (failedGeneration !== generation || disposed) return;
        ++generation;
        retire();
        dependencies.showError(error);
      });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      ++generation;
      retire();
    },
  };
}
