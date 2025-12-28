// --- PROJECTION 1: PILOT VIEW ---

function projectWorld(p) {
  let dx = p.x - plane.x;
  let dy = p.y - plane.y;
  let dz = p.z - plane.z;

  // Inverse Camera Rotations
  const totalYaw = plane.yaw + pilot.azimuth;
  const r1 = rotate2D(dx, dy, -totalYaw);
  dx = r1.a;
  dy = r1.b;

  const totalPitch = plane.pitch + pilot.elevation;
  const r2 = rotate2D(dy, dz, -totalPitch);
  dy = r2.a;
  dz = r2.b;

  const r3 = rotate2D(dx, dz, -plane.roll);
  dx = r3.a;
  dz = r3.b;

  if (dy <= 0.1) return null;

  return {
    x: ((dx * FOCAL_LENGTH) / dy + 0.5) * WIDTH,
    y: (0.5 - (dz * FOCAL_LENGTH) / dy) * HEIGHT,
  };
}

function projectCockpit({ x, y, z }) {
  let dx = x;
  let dy = y;
  let dz = z;

  let r1 = rotate2D(dx, dy, -pilot.azimuth);
  dx = r1.a;
  dy = r1.b;

  let r2 = rotate2D(dy, dz, -pilot.elevation);
  dy = r2.a;
  dz = r2.b;

  if (dy <= 0.1) return null;

  return {
    x: ((dx * FOCAL_LENGTH) / dy + 0.5) * WIDTH,
    y: (0.5 - (dz * FOCAL_LENGTH) / dy) * HEIGHT,
  };
}

// --- PROJECTION 2: TOP VIEW ---

function projectTop({ x, y, z }) {
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

function getPlaneWorldPoint(localP) {
  let px = localP.x;
  let py = localP.y;
  let pz = localP.z;

  // Local -> World Rotations
  let r1 = rotate2D(px, pz, plane.roll);
  px = r1.a;
  pz = r1.b;

  let r2 = rotate2D(py, pz, plane.pitch);
  py = r2.a;
  pz = r2.b;

  let r3 = rotate2D(px, py, plane.yaw);
  px = r3.a;
  py = r3.b;

  return {
    x: px + plane.x,
    y: py + plane.y,
    z: pz + plane.z,
  };
}

function projectPlane(p) {
  return projectTop(getPlaneWorldPoint(p));
}
