import type { KeplerianOrbit, Vec3 } from "./domainPorts.js";
import { vec3 } from "./vec3.js";
import { mat3 } from "./mat3.js";

/**
 * Solve Kepler's equation for eccentric anomaly E given mean anomaly M and
 * eccentricity e.
 *
 * Uses a simple Newton–Raphson iteration, which converges quickly for
 * the small eccentricities typical of solar system planets.
 */
function solveEccentricAnomaly(
  meanAnomalyRad: number,
  eccentricity: number,
  tol = 1e-10,
  maxIter = 20,
): number {
  const e = eccentricity;
  let M = meanAnomalyRad % (2 * Math.PI);
  if (M < 0) M += 2 * Math.PI;

  // Initial guess: for moderate e, E ≈ M is fine.
  let E = M;

  for (let i = 0; i < maxIter; i++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const dE = -f / fp;
    E += dE;
    if (Math.abs(dE) < tol) break;
  }

  return E;
}

const RzOmega = mat3.zero();
const Rxi = mat3.zero();
const Rzw = mat3.zero();
const Rtemp = mat3.zero();
const R = mat3.zero();

/**
 * Convert Keplerian elements to position and velocity in the inertial
 * reference frame at t = epoch (M = meanAnomalyAtEpochRad).
 *
 * The centralMassKg is the gravitational parameter source via:
 *   mu = G * M_central.
 *
 * The reference frame (orientation of the reference plane and zero of
 * longitude) is defined by the caller. The angles in the KeplerianOrbit
 * are interpreted relative to that frame.
 */
export function mutateStateVectorFromKeplerian(
  state: { position: Vec3; velocity: Vec3 },
  orbit: KeplerianOrbit,
  centralMassKg: number,
  G: number,
): void {
  const {
    semiMajorAxis: a,
    eccentricity: e,
    inclinationRad: i,
    lonAscNodeRad: Omega,
    argPeriapsisRad: omega,
    meanAnomalyAtEpochRad: M0,
  } = orbit;

  const mu = G * centralMassKg;

  // 1) Solve Kepler's equation: M0 -> E
  const E = solveEccentricAnomaly(M0, e);

  // 2) True anomaly ν and radius r in orbital plane (perifocal frame)
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);

  const r = a * (1 - e * cosE);

  const cosNu = (cosE - e) / (1 - e * cosE);
  const sinNu = (Math.sqrt(1 - e * e) * sinE) / (1 - e * cosE);
  const nu = Math.atan2(sinNu, cosNu);

  // 3) Position and velocity in perifocal frame (PQW)
  const xPQW = r * Math.cos(nu);
  const yPQW = r * Math.sin(nu);
  const zPQW = 0;

  // Orbital speed magnitude from vis-viva
  const vMag = Math.sqrt(mu * (2 / r - 1 / a));

  // Velocity direction is tangential in the orbital plane:
  // rotate position by +90° within the plane.
  const vxPQW = -vMag * Math.sin(nu);
  const vyPQW = vMag * Math.cos(nu);
  const vzPQW = 0;

  // 4) Rotate from PQW to inertial frame.
  //
  // Standard 3-1-3 rotation: R = Rz(Ω) * Rx(i) * Rz(ω)
  // Build rotation R = Rz(Ω) * Rx(i) * Rz(ω)
  mat3.rotZInto(RzOmega, Omega);
  mat3.rotXInto(Rxi, i);
  mat3.rotZInto(Rzw, omega);

  mat3.mulMat3Into(Rtemp, RzOmega, Rxi);
  mat3.mulMat3Into(R, Rtemp, Rzw);

  mat3.mulVec3Into(state.position, R, vec3.create(xPQW, yPQW, zPQW));
  mat3.mulVec3Into(state.velocity, R, vec3.create(vxPQW, vyPQW, vzPQW));
}
