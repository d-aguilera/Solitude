import {
  standaloneGenerationOption,
  standaloneModeOption,
} from "@solitude/plugin-api/standalone-session";
import { describe, expect, it } from "vitest";
import {
  createRunOptions,
  menuUrl,
  resolveStandaloneEntry,
} from "../standaloneSelection";

describe("standalone entry selection", () => {
  it("shows the menu for default and locale-only entry", () => {
    expect(resolveStandaloneEntry({})).toEqual({ kind: "menu" });
    expect(resolveStandaloneEntry({ locale: "es" })).toEqual({ kind: "menu" });
  });
  it("honors explicit modes and rejects unknown modes instead of falling back", () => {
    expect(
      resolveStandaloneEntry({
        mode: "my-first-orbit",
        diagnostic: "playback",
      }),
    ).toEqual({ kind: "run", mode: "my-first-orbit" });
    expect(resolveStandaloneEntry({ mode: "free-flight" })).toEqual({
      kind: "run",
      mode: "free-flight",
    });
    expect(
      resolveStandaloneEntry({ mode: "other", diagnostic: "capture" }),
    ).toEqual({ kind: "error" });
    expect(resolveStandaloneEntry({ diagnostic: "capture" })).toEqual({
      kind: "run",
      mode: "free-flight",
    });
  });
  it("resolves reserved options before assembly and removes conflicting adventure tuning", () => {
    const base = {
      mode: "my-first-orbit",
      locale: "fr",
      orbitalSpeedMultiplier: "900",
      diagnostic: "playback",
      timeScale: "100",
      [standaloneGenerationOption]: "fake",
    };
    expect(createRunOptions(base, "my-first-orbit", 3)).toEqual({
      locale: "fr",
      orbitalSpeedMultiplier: "1",
      [standaloneModeOption]: "my-first-orbit",
      [standaloneGenerationOption]: "3",
    });
    expect(createRunOptions(base, "free-flight", 4)).toMatchObject({
      orbitalSpeedMultiplier: "900",
      diagnostic: "playback",
      [standaloneModeOption]: "free-flight",
      [standaloneGenerationOption]: "4",
    });
    expect(base.mode).toBe("my-first-orbit");
  });
  it("clears direct entry options while preserving locale on return", () => {
    expect(
      menuUrl(
        "https://example.com/game?mode=my-first-orbit&locale=fr&diagnostic=playback&orbitalSpeedMultiplier=20#x",
      ),
    ).toBe("https://example.com/game?locale=fr#x");
  });
});
