#version 300 es
precision highp float;
precision highp int;

in vec3 aPosition;
in vec3 aNormal;
in vec3 aFaceAnchor;

uniform mat3 uModelOrientation;
uniform float uModelScale;
uniform vec3 uModelTranslation;
uniform vec3 uCameraRight;
uniform vec3 uCameraForward;
uniform vec3 uCameraUp;
uniform vec2 uFocalLength;
uniform float uNearDepth;
uniform sampler2D uLights;
uniform int uLightCount;
uniform int uEmissive;
uniform int uSmoothSphereShading;
uniform float uExposure;
uniform float uGamma;

out float vIntensity;
out float vCameraDepth;
out vec3 vLocalPosition;

void main() {
  vLocalPosition = aPosition;
  vec3 worldRelative =
    uModelOrientation * (aPosition * uModelScale) + uModelTranslation;
  vec3 cameraPoint = vec3(
    dot(worldRelative, uCameraRight),
    dot(worldRelative, uCameraForward),
    dot(worldRelative, uCameraUp)
  );
  gl_Position = vec4(
    cameraPoint.x * uFocalLength.x,
    cameraPoint.z * uFocalLength.y,
    cameraPoint.y - 2.0 * uNearDepth,
    cameraPoint.y
  );
  vCameraDepth = cameraPoint.y;

  if (uEmissive == 1) {
    vIntensity = 1.0;
    return;
  }

  vec3 localNormal = uSmoothSphereShading == 1 ? normalize(aPosition) : aNormal;
  vec3 normal = normalize(uModelOrientation * localNormal);
  vec3 anchor =
    uModelOrientation * (aFaceAnchor * uModelScale) + uModelTranslation;
  float irradiance = 0.0;
  for (int lightIndex = 0; lightIndex < uLightCount; lightIndex++) {
    vec4 light = texelFetch(uLights, ivec2(lightIndex, 0), 0);
    vec3 toLight = light.xyz - anchor;
    float distanceSquared = dot(toLight, toLight);
    if (distanceSquared <= 0.0) continue;
    float normalLight = dot(normal, toLight * inversesqrt(distanceSquared));
    if (normalLight <= 0.0) continue;
    irradiance += (light.w / (12.566370614359172 * distanceSquared)) * normalLight;
  }
  float hdr = uExposure * irradiance;
  float mapped = hdr / (1.0 + hdr);
  vIntensity = pow(clamp(mapped, 0.0, 1.0), uGamma);
}
