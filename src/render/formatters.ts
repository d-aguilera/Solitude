import { AU, C, km } from "../domain/units.js";

const onePercentC = C / 100.0;

// Time units in seconds
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
// Use a 365‑day year; this is only for display.
const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;

export function formatDistance(distanceMeters: number): string {
  if (distanceMeters >= AU) {
    return (distanceMeters / AU).toFixed(2).concat(" AU");
  }
  if (distanceMeters >= 1000) {
    return Math.round(distanceMeters / km)
      .toString()
      .concat(" km");
  }
  return distanceMeters.toString();
}

export function formatSpeed(speedMps: number): string {
  if (speedMps >= onePercentC) {
    return (speedMps / onePercentC).toFixed(2).concat("% C");
  }
  return Math.round(speedMps * 3.6)
    .toString()
    .concat(" km/h");
}

// Scratch array reused by formatSimTime to avoid per-call allocations.
const simTimePartsScratch: string[] = [];

/**
 * Format a simulation time in seconds into a compact multi‑unit string.
 *
 * Examples:
 *  - < 1 minute: "12s"
 *  - 1m 5s: "1m 05s"
 *  - 2h 3m 4s: "2h 03m 04s"
 *  - 3d 4h 5m 6s: "3d 04h 05m 06s"
 *  - 1y 2d 3h 4m 5s: "1y 2d 03h 04m 05s"
 *
 * Higher units are omitted when they would be zero, so the string stays compact.
 */
export function formatSimTime(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;

  let remaining = Math.floor(totalSeconds);

  const years = Math.floor(remaining / SECONDS_PER_YEAR);
  remaining -= years * SECONDS_PER_YEAR;

  const days = Math.floor(remaining / SECONDS_PER_DAY);
  remaining -= days * SECONDS_PER_DAY;

  const hours = Math.floor(remaining / SECONDS_PER_HOUR);
  remaining -= hours * SECONDS_PER_HOUR;

  const minutes = Math.floor(remaining / SECONDS_PER_MINUTE);
  remaining -= minutes * SECONDS_PER_MINUTE;

  const seconds = remaining;

  // Helper to pad to 2 digits.
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  let count = 0;

  if (years > 0) {
    simTimePartsScratch[count++] = `${years}y`;
  }

  if (days > 0 || years > 0) {
    simTimePartsScratch[count++] = `${days}d`;
  }

  if (hours > 0 || days > 0 || years > 0) {
    simTimePartsScratch[count++] = `${pad2(hours)}h`;
  }

  if (minutes > 0 || hours > 0 || days > 0 || years > 0) {
    simTimePartsScratch[count++] = `${pad2(minutes)}m`;
  }

  // Always show seconds.
  simTimePartsScratch[count++] = `${pad2(seconds)}s`;

  // Use only the filled prefix; we keep the backing array for reuse.
  return simTimePartsScratch.slice(0, count).join(" ");
}
