#version 300 es
precision highp float;

uniform float uLogDepthRange;
uniform float uNearDepth;

in float vCameraDepth;
in vec3 vColor;
out vec4 outColor;

void main() {
  outColor = vec4(vColor, 1.0);
  gl_FragDepth = clamp(
    log2(max(vCameraDepth, uNearDepth) / uNearDepth) / uLogDepthRange,
    0.0,
    1.0
  );
}
