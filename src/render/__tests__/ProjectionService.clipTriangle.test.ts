import { describe, expect, it } from "vitest";
import type { DomainCameraPose } from "../../app/scenePorts.js";
import { EPS_LEN } from "../../domain/epsilon.js";
import { vec3, type Vec3 } from "../../domain/vec3.js";
import { ProjectionService } from "../ProjectionService.js";

function makeTestPose(): DomainCameraPose {
  return {
    position: vec3.create(0, 0, 0),
    frame: {
      right: vec3.create(1, 0, 0),
      forward: vec3.create(0, 1, 0),
      up: vec3.create(0, 0, 1),
    },
  };
}

// Helper to allocate the `into` structure used by clipTriangleAgainstFrustumCamera
function makeTriangleScratch(): [
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
] {
  return [
    [vec3.zero(), vec3.zero(), vec3.zero()],
    [vec3.zero(), vec3.zero(), vec3.zero()],
    [vec3.zero(), vec3.zero(), vec3.zero()],
    [vec3.zero(), vec3.zero(), vec3.zero()],
    [vec3.zero(), vec3.zero(), vec3.zero()],
    [vec3.zero(), vec3.zero(), vec3.zero()],
  ];
}

describe("ProjectionService.clipTriangleAgainstFrustumCamera", () => {
  const pose = makeTestPose();
  const canvasWidth = 1920;
  const canvasHeight = 945;
  const proj = new ProjectionService(pose, canvasWidth, canvasHeight);

  it("keeps a triangle fully inside the frustum unchanged", () => {
    // Choose 3 points clearly inside the frustum:
    // y > NEAR and within the FOV on x/z.
    const a = vec3.create(0, 1, 0); // center in front of camera
    const b = vec3.create(0.1, 1, 0); // small offset in +x
    const c = vec3.create(0, 1, 0.1); // small offset in +z

    const into = makeTriangleScratch();

    const triCount = proj.clipTriangleAgainstFrustumCamera(into, a, b, c);

    expect(triCount).toBe(1);
    const [T0, T1, T2] = into[0];

    // Because everything is well inside, clipping should leave them effectively identical.
    expect(T0.x).toBeCloseTo(a.x);
    expect(T0.y).toBeCloseTo(a.y);
    expect(T0.z).toBeCloseTo(a.z);

    expect(T1.x).toBeCloseTo(b.x);
    expect(T1.y).toBeCloseTo(b.y);
    expect(T1.z).toBeCloseTo(b.z);

    expect(T2.x).toBeCloseTo(c.x);
    expect(T2.y).toBeCloseTo(c.y);
    expect(T2.z).toBeCloseTo(c.z);
  });

  it("returns 0 triangles if the triangle is entirely behind the near plane", () => {
    // Entire triangle with y < NEAR (behind camera/near plane).
    const a = vec3.create(0, 0, 0);
    const b = vec3.create(0.1, 0, 0);
    const c = vec3.create(0, 0, 0.1);

    const into = makeTriangleScratch();
    const triCount = proj.clipTriangleAgainstFrustumCamera(into, a, b, c);

    expect(triCount).toBe(0);
  });

  it("clips a triangle that partially intersects the near plane", () => {
    // Two points in front of the near plane, one just behind it.
    // NEAR constant in ProjectionService is 0.01.
    const a = vec3.create(0, 0.02, 0); // inside
    const b = vec3.create(0.01, 0.02, 0); // inside
    const c = vec3.create(0, 0.0, 0); // behind near plane

    const into = makeTriangleScratch();
    const triCount = proj.clipTriangleAgainstFrustumCamera(into, a, b, c);

    // A clipped triangle can become up to 2 triangles, but for this simple cut
    // it typically remains 1 or 2. We assert it's not fully rejected:
    expect(triCount).toBeGreaterThan(0);

    // Check that all resulting vertices are on or in front of the NEAR plane:
    for (let i = 0; i < triCount; i++) {
      const [T0, T1, T2] = into[i];
      [T0, T1, T2].forEach((p) => {
        expect(p.y).toBeGreaterThanOrEqual(0.01 - EPS_LEN);
      });
    }
  });

  it("produces at most 6 triangles", () => {
    // TODO: find a case where 6 triangles are produced.
    const a = vec3.create(
      350462.3457402566,
      107500.15684581251,
      -101596.49124966018,
    );
    const b = vec3.create(
      299615.2401618481,
      945210.8795426243,
      254594.99776978022,
    );
    const c = vec3.create(
      -517945.71986603644,
      366681.6486267394,
      -2050.291847351473,
    );

    const into = makeTriangleScratch();
    const triCount = proj.clipTriangleAgainstFrustumCamera(into, a, b, c);

    expect(triCount).toBe(5);
  });
});
