#version 300 es
precision highp float;

uniform vec3 uBaseColor;
uniform float uAmbient;
uniform float uDiffuse;
uniform float uLogDepthRange;
uniform float uNearDepth;
flat in float vIntensity;
in float vCameraDepth;
out vec4 outColor;

void main() {
  float factor = uAmbient + uDiffuse * vIntensity;
  outColor = vec4(uBaseColor * factor, 1.0);
  gl_FragDepth = clamp(
    log2(max(vCameraDepth, uNearDepth) / uNearDepth) / uLogDepthRange,
    0.0,
    1.0
  );
}
