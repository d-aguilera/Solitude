import { createOrbitObservation } from "@solitude/plugin-api/telemetry";
import { describe, expect, it } from "vitest";
import { createOrbitObservationProvider } from "../../orbit-telemetry/observation";
import { createTestWorldAndBody } from "../shared/hudTest";

describe("shared validated orbit observations", () => {
  it("reports circular altitude and Earth-relative alignment with a moving primary", () => {
    const { world, body } = createTestWorldAndBody();
    const earth = world.collisionSpheres[0];
    earth.state.velocity.x = 30_000;
    body.velocity.x += 30_000;
    body.frame.forward = { x: 0, y: 1, z: 0 };
    const out = createOrbitObservation();
    createOrbitObservationProvider().sampleInto(out, world, body.id);
    expect(out.orbitValid).toBe(true);
    expect(out.altitudeMeters).toBeCloseTo(400_000, 4);
    expect(out.periapsisAltitudeMeters).toBeCloseTo(400_000, 4);
    expect(out.apoapsisAltitudeMeters).toBeCloseTo(400_000, 4);
    expect(out.progradeAlignmentCosine).toBeCloseTo(1, 8);
  });
  it("keeps a negative periapsis valid and clears the apoapsis on escape", () => {
    const { world, body } = createTestWorldAndBody();
    const out = createOrbitObservation();
    const provider = createOrbitObservationProvider();
    body.velocity.y *= 0.95;
    provider.sampleInto(out, world, body.id);
    expect(out.orbitValid).toBe(true);
    expect(out.periapsisAltitudeMeters!).toBeLessThan(0);
    body.velocity.y *= 2;
    provider.sampleInto(out, world, body.id);
    expect(out.orbitValid).toBe(true);
    expect(out.isBound).toBe(false);
    expect(out.apoapsisAltitudeMeters).toBeNull();
  });
  it.each(["missing", "nonfinite", "radial", "radius", "mass", "center"])(
    "clears stale values when %s data makes the observation unavailable",
    (problem) => {
      const { world, body } = createTestWorldAndBody();
      const out = createOrbitObservation();
      const provider = createOrbitObservationProvider();
      provider.sampleInto(out, world, body.id);
      expect(out.orbitValid).toBe(true);
      if (problem === "nonfinite") body.velocity.y = NaN;
      if (problem === "radial") body.velocity = { x: 100, y: 0, z: 0 };
      if (problem === "radius") world.collisionSpheres[0].radius = NaN;
      if (problem === "mass") world.gravityMasses[1].mass = Infinity;
      if (problem === "center")
        body.position = { ...world.collisionSpheres[0].state.position };
      provider.sampleInto(
        out,
        world,
        problem === "missing" ? "absent" : body.id,
      );
      expect(out.orbitValid).toBe(false);
      expect(out.isBound).toBe(false);
      expect(out.periapsisAltitudeMeters).toBeNull();
      expect(out.apoapsisAltitudeMeters).toBeNull();
      expect(out.radialSpeedMetersPerSecond).toBeNull();
      expect(out.progradeAlignmentCosine).toBeNull();
    },
  );
});
