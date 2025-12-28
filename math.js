function getFocalLength() {
  const fovRad = (FIELD_OF_VIEW * Math.PI) / 180;
  return 1 / Math.tan(fovRad / 2);
}

function rotate2D(a, b, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return {
    a: a * c - b * s,
    b: a * s + b * c,
  };
}
