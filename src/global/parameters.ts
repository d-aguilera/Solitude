export const parameters = {
  /** Gravitational constant in m^3 / (kg * s^2). */
  newtonG: 6.6743e-11,
  /** Small softening term to avoid singularities when bodies get very close. */
  softeningLength: 1.0,
  timeScale: 1.0, // real time
  // timeScale: 1_024, // 17m 4s per actual second
  // timeScale: 65_536, // 18h 12m 16s per actual second
  // timeScale: 262_144, // 3d 0h 49m 4s per actual second
};
