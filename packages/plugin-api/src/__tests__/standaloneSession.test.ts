import { expect, it } from "vitest";
import { isStandaloneEntrySession } from "../standalone-entry";
import {
  isStandaloneSession,
  type StandaloneSession,
} from "../standalone-session";

it("accepts a reusable lifecycle without Solitude menu labels or First Orbit data", () => {
  const session: StandaloneSession = {
    generation: 4,
    mode: "docking-practice",
    phase: "briefing",
    advanceSimulation: false,
    lifecycleRequest: null,
    getPresentation: () => null,
    command: () => {},
    subscribe: () => () => {},
    attachInputReset: () => () => {},
  };
  expect(isStandaloneSession(session)).toBe(true);
  expect(isStandaloneEntrySession(session)).toBe(false);
  expect(isStandaloneEntrySession({ ...session, mode: "free-flight" })).toBe(
    false,
  );
});
