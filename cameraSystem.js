import { plane, topCamera, FOCAL_LENGTH } from "./setup.js";

export function updateTopCamera(objectsToKeepInView) {
  // Camera is always directly above the airplane in X/Y (meters)
  topCamera.x = plane.x;
  topCamera.y = plane.y;

  // If no objects, just keep a simple camera height above the plane
  if (objectsToKeepInView.length == 0) {
    const offsetAbovePlane = 30; // m
    topCamera.z = Math.max(50, plane.z + offsetAbovePlane); // at least 50 m AGL-ish
    return;
  }

  let maxHorizDist = 0; // max horizontal distance from plane to any object
  let avgObjZ = 0; // average object altitude (for a ground reference)

  for (let obj of objectsToKeepInView) {
    const c = obj.center ?? obj;
    const dx = c.x - plane.x;
    const dy = c.y - plane.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxHorizDist) maxHorizDist = dist;
    avgObjZ += c.z;
  }
  avgObjZ /= objectsToKeepInView.length;

  // Compute how far above the objects the camera must be so all objects fit
  const margin = 1.3;

  // from topView: |(dx * FOCAL_LENGTH) / dist| <= 0.5
  // => dist >= maxHorizDist * FOCAL_LENGTH / 0.5
  const baseDist = (maxHorizDist * FOCAL_LENGTH) / 0.5;
  const distToObjects = baseDist * margin;

  const minHeightAboveObjects = 20;
  const heightFromObjects = Math.max(
    avgObjZ + distToObjects,
    avgObjZ + minHeightAboveObjects
  );

  // Ensure the camera is never below the airplane
  const minOffsetAbovePlane = 50; // small buffer so we're always above the plane
  const heightFromPlane = plane.z + minOffsetAbovePlane;

  // Final camera height:
  topCamera.z = Math.max(heightFromObjects, heightFromPlane);
}
