// E = I / (4π r²) at 1 AU from the Sun.
const SUN_LUMINOSITY = 3.828e26; // W
const AU = 1.495978707e11; // m
const EARTH_ORBIT_RADIUS_2 = AU * AU;
export const E_SUN_AT_EARTH =
  SUN_LUMINOSITY / (4 * Math.PI * EARTH_ORBIT_RADIUS_2);
