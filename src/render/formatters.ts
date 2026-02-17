import { AU, C, km } from "../app/appPorts.js";

const onePercentC = C / 100.0;

export function formatDistance(distanceMeters: number): string {
  if (distanceMeters >= AU) {
    return `${(distanceMeters / AU).toFixed(2)} AU`;
  }
  if (distanceMeters >= 1000) {
    return `${Math.round(distanceMeters / km)} km`;
  }
  return `${distanceMeters}`;
}

export function formatSpeed(speedMps: number): string {
  if (speedMps >= onePercentC) {
    return `${(speedMps / onePercentC).toFixed(2)}% C`;
  }
  return `${(speedMps * 3.6).toFixed(2)} km/h`;
}
