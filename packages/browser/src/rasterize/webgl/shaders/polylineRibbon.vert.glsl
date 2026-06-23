#version 300 es
precision highp float;

in vec4 aClipPosition;
in float aCameraDepth;
in vec3 aColor;

out float vCameraDepth;
out vec3 vColor;

void main() {
  gl_Position = aClipPosition;
  vCameraDepth = aCameraDepth;
  vColor = aColor;
}
