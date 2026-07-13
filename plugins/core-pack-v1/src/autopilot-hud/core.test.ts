import { describe, expect, it } from "vitest";
import {
  columnTexts,
  createTestHudContext,
  createTestHudGrid,
  createTestWorldAndBody,
  getHudPanel,
} from "../shared/hudTest";
import { createPlugin } from "./index";

describe("autopilot HUD plugin", () => {
  it("reads circle-now diagnostics from the focused body", () => {
    const { world, body } = createTestWorldAndBody();
    const context = createTestHudContext(world, body);
    context.controlInput.circleNow = true;
    const grid = createTestHudGrid();

    getHudPanel(createPlugin({ locale: "en" })).writeHud(grid, context);

    expect(columnTexts(grid, "rightCenter")).toEqual(["AP: VEL BODY ORB [CN]"]);
  });

  it("localizes the active autopilot mode", () => {
    const { world, body } = createTestWorldAndBody();
    const context = createTestHudContext(world, body);
    context.controlInput.alignToBody = true;
    const grid = createTestHudGrid();

    getHudPanel(createPlugin({ locale: "es" })).writeHud(grid, context);

    expect(columnTexts(grid, "rightCenter")).toEqual([
      "PA: VEL [CUERPO] ORB CN",
    ]);
  });

  it("warns when circle-now has no dominant gravity body", () => {
    const { world, body } = createTestWorldAndBody();
    world.collisionSpheres.length = 0;
    world.gravityMasses.length = 0;
    const context = createTestHudContext(world, body);
    context.controlInput.circleNow = true;
    const grid = createTestHudGrid();

    getHudPanel(createPlugin({ locale: "en" })).writeHud(grid, context);

    expect(columnTexts(grid, "rightCenter")).toEqual([
      "AP: VEL BODY ORB [CN]",
      "!! CN WARN: NO TAN",
    ]);
  });
});
