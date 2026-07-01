#version 300 es
precision highp float;

uniform vec3 uBaseColor;
uniform sampler2D uColorTexture;
uniform sampler2D uOverlayTexture;
uniform float uAmbient;
uniform float uDiffuse;
uniform float uLogDepthRange;
uniform float uNearDepth;
uniform float uOverlayOpacity;
uniform float uTextureLongitudeOffset;
uniform int uRenderMode;
uniform int uUseColorTexture;
uniform vec3 uAtmosphereColor;
in float vIntensity;
in float vCameraDepth;
in vec3 vCameraNormal;
in vec3 vCameraPoint;
in vec3 vLocalPosition;
out vec4 outColor;

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;

vec2 getSphericalUv() {
  vec3 normal = normalize(vLocalPosition);
  float u = fract((atan(normal.y, normal.x) + uTextureLongitudeOffset) / TAU + 0.5);
  float v = 0.5 - asin(clamp(normal.z, -1.0, 1.0)) / PI;
  return vec2(u, v);
}

vec3 getAlbedo() {
  if (uUseColorTexture != 1) return uBaseColor;
  return texture(uColorTexture, getSphericalUv()).rgb;
}

float getAtmosphereRim() {
  vec3 normal = normalize(vCameraNormal);
  vec3 toCamera = -normalize(vCameraPoint);
  float facing = max(dot(normal, toCamera), 0.0);
  return pow(1.0 - facing, 2.35);
}

void main() {
  float factor = uAmbient + uDiffuse * vIntensity;
  float fragmentDepth = clamp(
    log2(max(vCameraDepth, uNearDepth) / uNearDepth) / uLogDepthRange,
    0.0,
    1.0
  );
  if (uRenderMode == 2) {
    vec3 cloud = texture(uOverlayTexture, getSphericalUv()).rgb;
    float alpha = clamp(max(max(cloud.r, cloud.g), cloud.b) * uOverlayOpacity, 0.0, 1.0);
    outColor = vec4(vec3(factor), alpha);
    gl_FragDepth = fragmentDepth;
    return;
  }
  if (uRenderMode == 3) {
    float sunlight = 0.55 + 0.45 * vIntensity;
    float alpha = clamp(getAtmosphereRim() * uOverlayOpacity * sunlight, 0.0, 1.0);
    outColor = vec4(uAtmosphereColor, alpha);
    gl_FragDepth = fragmentDepth;
    return;
  }

  outColor = vec4(getAlbedo() * factor, 1.0);
  gl_FragDepth = fragmentDepth;
}
