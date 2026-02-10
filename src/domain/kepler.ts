import type { KeplerianOrbit, Vec3 } from "./domainPorts.js";
import { vec3 } from "./vec3.js";

/**
 * Solve Kepler's equation for eccentric anomaly E given mean anomaly M and
 * eccentricity e.
 *
 * Uses a simple Newton–Raphson iteration, which converges quickly for
 * the small eccentricities typical of solar system planets.
 */
export function solveEccentricAnomaly(
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
export function stateVectorFromKeplerian(
  orbit: KeplerianOrbit,
  centralMassKg: number,
  G: number,
): { position: Vec3; velocity: Vec3 } {
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
  const cosO = Math.cos(Omega);
  const sinO = Math.sin(Omega);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);
  const cosw = Math.cos(omega);
  const sinw = Math.sin(omega);

  // Precompute rotation matrix elements for position and velocity
  const R11 = cosO * cosw - sinO * sinw * cosI;
  const R12 = -cosO * sinw - sinO * cosw * cosI;
  const R13 = sinO * sinI;
  const R21 = sinO * cosw + cosO * sinw * cosI;
  const R22 = -sinO * sinw + cosO * cosw * cosI;
  const R23 = -cosO * sinI;
  const R31 = sinw * sinI;
  const R32 = cosw * sinI;
  const R33 = cosI;

  const position: Vec3 = vec3.create(
    R11 * xPQW + R12 * yPQW + R13 * zPQW,
    R21 * xPQW + R22 * yPQW + R23 * zPQW,
    R31 * xPQW + R32 * yPQW + R33 * zPQW,
  );

  const velocity: Vec3 = vec3.create(
    R11 * vxPQW + R12 * vyPQW + R13 * vzPQW,
    R21 * vxPQW + R22 * vyPQW + R23 * vzPQW,
    R31 * vxPQW + R32 * vyPQW + R33 * vzPQW,
  );

  return { position, velocity };
}
