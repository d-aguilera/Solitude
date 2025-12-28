// --- PROJECTION 1: PILOT VIEW ---

function pilotView({ x, y, z }) {
  // Vector from plane to point in world space
  const dx = x - plane.x;
  const dy = y - plane.y;
  const dz = z - plane.z;

  const { right, forward, up } = getPlaneAxes();

  // Transform into plane's local space (camera space, before pilot look)
  // cameraX = dot(dx, right)
  // cameraY = dot(dx, forward)
  // cameraZ = dot(dx, up)
  let cx = dx * right.x + dy * right.y + dz * right.z;
  let cy = dx * forward.x + dy * forward.y + dz * forward.z;
  let cz = dx * up.x + dy * up.y + dz * up.z;

  // Apply pilot look as extra yaw (around up) and pitch (around right)
  if (pilot.azimuth !== 0 || pilot.elevation !== 0) {
    // Yaw around local up (rotate in cx-cy plane)
    if (pilot.azimuth !== 0) {
      const r1 = rotate2D(cx, cy, -pilot.azimuth);
      cx = r1.a;
      cy = r1.b;
    }
    // Pitch around local right (rotate in cy-cz plane)
    if (pilot.elevation !== 0) {
      const r2 = rotate2D(cy, cz, -pilot.elevation);
      cy = r2.a;
      cz = r2.b;
    }
  }

  // Clip behind camera
  if (cy <= 0.1) return null;

  return {
    x: ((cx * FOCAL_LENGTH) / cy + 0.5) * WIDTH,
    y: (0.5 - (cz * FOCAL_LENGTH) / cy) * HEIGHT,
  };
}

// --- PROJECTION 2: TOP VIEW ---

function topView({ x, y, z }) {
  // Use dynamic camera position
  const dx = x - topCamera.x;
  const dy = y - topCamera.y;
  const dist = topCamera.z - z;

  if (dist <= 1) return null;

  const vp = {
    x: (dx * FOCAL_LENGTH) / dist,
    y: (dy * FOCAL_LENGTH) / dist,
  };

  return {
    x: (vp.x + 0.5) * WIDTH,
    y: (0.5 - vp.y) * HEIGHT,
  };
}

function getPlaneAxes() {
  // orientation columns: [right, forward, up]
  const R = plane.orientation;
  const right = { x: R[0][0], y: R[1][0], z: R[2][0] };
  const forward = { x: R[0][1], y: R[1][1], z: R[2][1] };
  const up = { x: R[0][2], y: R[1][2], z: R[2][2] };
  return { right, forward, up };
}
