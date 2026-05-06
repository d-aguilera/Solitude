// Numerical tolerances by intent (units noted in comments).
// Prefer these over inline literals to keep thresholds consistent and documented.

// Angles (radians).
export const EPS_ANGLE_RAD = 1e-4;

// Lengths (unitless or meters depending on context).
export const EPS_LEN = 1e-6;
export const EPS_LEN_STRICT = 1e-8;
export const EPS_LEN_COARSE = 1e-4;

// Speeds (m/s).
export const EPS_SPEED_COARSE = 1e-4;
export const EPS_SPEED_FINE = 1e-6;
export const EPS_DELTA_V = 1e-9;

// Speed squared (m^2/s^2).
export const EPS_SPEED_SQ = 1e-24;

// Orbital parameters.
export const EPS_ECCENTRICITY = 1e-5;
export const EPS_TIME_SEC = 1e-6;
export const EPS_KEPLER_SOLVE = 1e-10;

// Dot-product closeness to 1 (unitless).
export const EPS_PARALLEL_DOT = 1e-6;
export const DOT_PARALLEL_COS = 1 - EPS_PARALLEL_DOT;
