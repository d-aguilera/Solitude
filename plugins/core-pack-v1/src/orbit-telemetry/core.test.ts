import { createEntityNameProvider } from "@solitude/plugin-api/capabilities";
import { vec3 } from "@solitude/plugin-api/math";
import { computeStandardGravitationalParameter } from "@solitude/plugin-api/world";
import { describe, expect, it } from "vitest";
import {
  columnTexts,
  createTestHudContext,
  createTestHudGrid,
  createTestWorldAndBody,
  getHudPanel,
} from "../shared/hudTest";
import { createPlugin } from "./index";

describe("orbit telemetry plugin", () => {
  it("writes orbit and circularization cells", () => {
    const { world, body } = createTestWorldAndBody();
    const panel = getHudPanel(createPlugin({ locale: "en" }));
    const grid = createTestHudGrid();

    panel.writeHud(grid, createTestHudContext(world, body));

    expect(columnTexts(grid, "left")[0]).toBe("Orbit: Earth (bound)");
    expect(columnTexts(grid, "left")[1]).toBe("d: 6771 km");
    expect(columnTexts(grid, "left")[2]).toBe("Pe/Ap: 6771 km / 6771 km");
    expect(columnTexts(grid, "left")[3]).toBe("e: 0.000");
    expect(columnTexts(grid, "left")[4]).toBe("i: 0.0°");
    expect(columnTexts(grid, "leftCenter")[0]).toContain("Δv Rad: ");
    expect(columnTexts(grid, "leftCenter")[1]).toContain("Δv Tan: ");
  });

  it("writes escape periapsis and inbound timing", () => {
    const { world, body } = createTestWorldAndBody();
    const planetMass = 5.972e24;
    const eccentricity = 1.5;
    const periapsis = 10_000_000;
    const radius = 25_000_000;
    const semiLatusRectum = periapsis * (1 + eccentricity);
    const mu = computeStandardGravitationalParameter(planetMass);
    const angularMomentum = Math.sqrt(mu * semiLatusRectum);
    const radialSpeed = -((mu / angularMomentum) * eccentricity);
    const tangentialSpeed = angularMomentum / radius;
    const panel = getHudPanel(createPlugin({ locale: "en" }));
    const grid = createTestHudGrid();
    const context = createTestHudContext(world, body);

    body.position = vec3.create(radius, 0, 0);
    body.velocity = vec3.create(radialSpeed, tangentialSpeed, 0);
    panel.writeHud(grid, context);

    expect(columnTexts(grid, "left")[0]).toBe("Orbit: Earth (escape)");
    expect(columnTexts(grid, "left")[1]).toBe("d: 25000 km");
    expect(columnTexts(grid, "left")[2]).toBe("Pe/Ap: 10000 km / --");
    expect(columnTexts(grid, "leftCenter")[2]).toMatch(/^Pe in: /);
    expect(columnTexts(grid, "leftCenter")[2]).not.toBe("Pe in: --");
    expect(columnTexts(grid, "leftCenter")[3]).toBe("Ap in: --");

    const outboundGrid = createTestHudGrid();
    body.velocity = vec3.create(-radialSpeed, tangentialSpeed, 0);
    panel.writeHud(outboundGrid, context);

    expect(columnTexts(outboundGrid, "left")[2]).toBe("Pe/Ap: 10000 km / --");
    expect(columnTexts(outboundGrid, "leftCenter")[2]).toBe("Pe in: --");
    expect(columnTexts(outboundGrid, "leftCenter")[3]).toBe("Ap in: --");
  });

  it("keeps delta-v direction labels stable inside the deadband", () => {
    const { world, body } = createTestWorldAndBody();
    const orbitRadius = vec3.length(body.position);
    const circularSpeed = Math.sqrt(
      computeStandardGravitationalParameter(5.972e24) / orbitRadius,
    );
    const panel = getHudPanel(createPlugin({ locale: "en" }));
    const grid = createTestHudGrid();
    const context = createTestHudContext(world, body);

    body.velocity = vec3.create(-1, circularSpeed - 1, 0);
    panel.writeHud(grid, context);
    expect(columnTexts(grid, "leftCenter")[0]).toContain(" out");
    expect(columnTexts(grid, "leftCenter")[1]).toContain(" pro");

    body.velocity = vec3.create(0.000001, circularSpeed + 0.000001, 0);
    panel.writeHud(grid, context);
    expect(columnTexts(grid, "leftCenter")[0]).toContain(" out");
    expect(columnTexts(grid, "leftCenter")[1]).toContain(" pro");

    body.velocity = vec3.create(0.02, circularSpeed + 0.02, 0);
    panel.writeHud(grid, context);
    expect(columnTexts(grid, "leftCenter")[0]).toContain(" in");
    expect(columnTexts(grid, "leftCenter")[1]).toContain(" retro");
  });

  it("localizes primary body names", () => {
    const { world, body } = createTestWorldAndBody();
    const panel = getHudPanel(createPlugin({ locale: "es" }));
    const grid = createTestHudGrid();
    const context = createTestHudContext(world, body, [
      createEntityNameProvider({
        formatEntityName: (entityId) =>
          entityId === "planet:earth" ? "Tierra" : null,
      }),
    ]);

    panel.writeHud(grid, context);

    expect(columnTexts(grid, "left")[0]).toBe("Órbita: Tierra (ligada)");
    expect(columnTexts(grid, "left")[1]).toBe("d: 6771 km");
    expect(columnTexts(grid, "left")[3]).toBe("e: 0,000");
    expect(columnTexts(grid, "left")[4]).toBe("i: 0,0°");
  });

  it("writes empty orbit cells when no primary is available", () => {
    const { world, body } = createTestWorldAndBody();
    world.collisionSpheres.length = 0;
    world.gravityMasses.length = 0;
    const panel = getHudPanel(createPlugin({ locale: "en" }));
    const grid = createTestHudGrid();

    panel.writeHud(grid, createTestHudContext(world, body));

    expect(columnTexts(grid, "left")).toEqual(["Orbit: --", "d: --"]);
    expect(columnTexts(grid, "leftCenter")).toEqual([]);
  });
});
