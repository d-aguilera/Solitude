#version 300 es
precision highp float;

uniform vec3 uBaseColor;
uniform sampler2D uColorTexture;
uniform float uAmbient;
uniform float uDiffuse;
uniform float uLogDepthRange;
uniform float uNearDepth;
uniform float uTextureLongitudeOffset;
uniform int uUseColorTexture;
in float vIntensity;
in float vCameraDepth;
in vec3 vLocalPosition;
out vec4 outColor;

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;

vec3 getAlbedo() {
  if (uUseColorTexture != 1) return uBaseColor;

  vec3 normal = normalize(vLocalPosition);
  float u = fract((atan(normal.y, normal.x) + uTextureLongitudeOffset) / TAU + 0.5);
  float v = 0.5 - asin(clamp(normal.z, -1.0, 1.0)) / PI;
  return texture(uColorTexture, vec2(u, v)).rgb;
}

void main() {
  float factor = uAmbient + uDiffuse * vIntensity;
  outColor = vec4(getAlbedo() * factor, 1.0);
  gl_FragDepth = clamp(
    log2(max(vCameraDepth, uNearDepth) / uNearDepth) / uLogDepthRange,
    0.0,
    1.0
  );
}
