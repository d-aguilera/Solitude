import { type Vec3, vec3 } from "./vec3.js";

function radialDirAtAngle(
  theta: number,
  radialAxis1: Vec3,
  radialAxis2: Vec3,
): Vec3 {
  const out: Vec3 = {
    x: radialAxis1.x * Math.cos(theta) + radialAxis2.x * Math.sin(theta),
    y: radialAxis1.y * Math.cos(theta) + radialAxis2.y * Math.sin(theta),
    z: radialAxis1.z * Math.cos(theta) + radialAxis2.z * Math.sin(theta),
  };
  return vec3.normalizeInto(out);
}

const scaled1Scratch = vec3.zero();
const scaled2Scratch = vec3.zero();

function tangentialDirAtAngle(
  theta: number,
  radialAxis1: Vec3,
  radialAxis2: Vec3,
): Vec3 {
  const s = Math.sin(theta);
  const c = Math.cos(theta);

  const scaled1 = vec3.scaleInto(scaled1Scratch, -s, radialAxis1);
  const scaled2 = vec3.scaleInto(scaled2Scratch, c, radialAxis2);
  const t = vec3.addInto(vec3.zero(), scaled1, scaled2);

  return vec3.normalizeInto(t);
}

export const trig = {
  /**
   * Compute a radial direction on a not-necessarily-axis-aligned ship
   * defined by two basis vectors.
   */
  radialDirAtAngle,

  /**
   * Local tangential direction around that orbit ship.
   */
  tangentialDirAtAngle,
};
