function updatePhysics() {
  const rotSpeed = 0.03;
  const lookSpeed = 0.03;

  // 1. Roll Control (Ailerons)
  if (keys.KeyA) plane.roll += rotSpeed;
  if (keys.KeyD) plane.roll -= rotSpeed;

  // 2. Pitch Control (Elevator)
  let pitchInput = 0;
  if (keys.KeyS) pitchInput = 1;
  if (keys.KeyW) pitchInput = -1;

  if (pitchInput !== 0) {
    plane.pitch += pitchInput * rotSpeed;
  }

  // 3. Pilot Look
  if (keys.ArrowLeft) pilot.azimuth += lookSpeed;
  if (keys.ArrowRight) pilot.azimuth -= lookSpeed;
  if (keys.ArrowUp) pilot.elevation += lookSpeed;
  if (keys.ArrowDown) pilot.elevation -= lookSpeed;

  // 4. Calculate Velocity
  const vZ = Math.sin(plane.pitch);
  const hMag = Math.cos(plane.pitch);
  const vX = -Math.sin(plane.yaw) * hMag;
  const vY = Math.cos(plane.yaw) * hMag;

  plane.x += vX * plane.speed;
  plane.y += vY * plane.speed;
  plane.z += vZ * plane.speed;
}

function getCenterOfMass(obj) {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  for (let p of obj.points) {
    sumX += p.x;
    sumY += p.y;
    sumZ += p.z;
  }
  const n = obj.points.length;
  return {
    x: sumX / n,
    y: sumY / n,
    z: sumZ / n,
  };
}

function updateTopCamera(objectsToKeepInView) {
  // 1. Camera is always directly above the airplane in X/Y
  topCamera.x = plane.x;
  topCamera.y = plane.y;

  // 2. If no objects, just keep a simple camera height above the plane
  if (objectsToKeepInView.length == 0) {
    const offsetAbovePlane = 30;
    topCamera.z = Math.max(50, plane.z + offsetAbovePlane);
    return;
  }

  // 3. Compute:
  //    - max horizontal distance from plane to any object
  //    - average object altitude (for a ground reference)
  let maxHorizDist = 0;
  let avgObjZ = 0;
  for (let obj of objectsToKeepInView) {
    const c = getCenterOfMass(obj);
    const dx = c.x - plane.x;
    const dy = c.y - plane.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxHorizDist) maxHorizDist = dist;
    avgObjZ += c.z;
  }
  avgObjZ /= objectsToKeepInView.length;

  // 4. Compute how far above the objects the camera must be so all objects fit
  const margin = 1.3; // tweak padding as you like

  // From projectTop: |(dx * FOCAL_LENGTH) / dist| <= 0.5
  // => dist >= maxHorizDist * FOCAL_LENGTH / 0.5
  const baseDist = (maxHorizDist * FOCAL_LENGTH) / 0.5;
  const distToObjects = baseDist * margin;

  const minHeightAboveObjects = 20;
  const heightFromObjects = Math.max(
    avgObjZ + distToObjects,
    avgObjZ + minHeightAboveObjects
  );

  // 5. Ensure the camera is never below the airplane
  const minOffsetAbovePlane = 5; // small buffer so we're always above the plane
  const heightFromPlane = plane.z + minOffsetAbovePlane;

  // Final camera height:
  topCamera.z = Math.max(heightFromObjects, heightFromPlane);
}

function render() {
  updatePhysics();
  updateTopCamera(cubes); // Update camera before rendering top view

  // --- RENDER PILOT VIEW ---
  clear(ctx);
  draw(ctx, ground, projectWorld);
  draw(ctx, cubes, projectWorld);
  draw(ctx, airplanes, projectCockpit);

  // --- RENDER TOP VIEW ---
  clear(ctxTop);
  draw(ctxTop, ground, projectTop);
  draw(ctxTop, cubes, projectTop);
  draw(ctxTop, airplanes, projectPlane);

  ctxTop.fillRect(0, 0, 200, 30);
  ctxTop.fillStyle = "white";
  ctxTop.font = "16px monospace";
  ctxTop.fillText(`Altitude: ${plane.z.toFixed(2)}`, 10, 20);

  setTimeout(render, FPS);
}
