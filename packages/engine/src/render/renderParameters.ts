import { AU } from "../domain/units";

export const renderNearDepth = 0.01;
export const renderVerticalFovDegrees = 30;
export const renderFocalLengthY =
  1 / Math.tan((renderVerticalFovDegrees * Math.PI) / 360);

const sunLuminosity = 3.828e26;
const earthOrbitRadiusSquared = AU * AU;
const sunIrradianceAtEarth =
  sunLuminosity / (4 * Math.PI * earthOrbitRadiusSquared);

export const renderAmbientFactor = 0.2;
export const renderDiffuseFactor = 0.8;
export const renderExposure = 10 / sunIrradianceAtEarth;
export const renderGamma = 1 / 1.3;

export function getRenderFocalLengthX(
  canvasWidth: number,
  canvasHeight: number,
): number {
  return renderFocalLengthY * (canvasHeight / canvasWidth);
}
