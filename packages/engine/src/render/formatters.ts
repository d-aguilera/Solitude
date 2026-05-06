import { AU, C, km } from "../domain/units";

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
 *  - 1m 5s: "01m 05s"
 *  - 2h 3m 4s: "02h 03m 04s"
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

  let count = 0;

  if (years > 0) {
    simTimePartsScratch[count++] = years.toString().concat("y");
  }

  if (days > 0 || years > 0) {
    simTimePartsScratch[count++] = days.toString().concat("d");
  }

  if (hours > 0 || days > 0 || years > 0) {
    simTimePartsScratch[count++] = formatTwoDigit(hours).concat("h");
  }

  if (minutes > 0 || hours > 0 || days > 0 || years > 0) {
    simTimePartsScratch[count++] = formatTwoDigit(minutes).concat("m");
  }

  // Always show seconds.
  simTimePartsScratch[count++] = formatTwoDigit(seconds).concat("s");

  switch (count) {
    case 1:
      return simTimePartsScratch[0];
    case 2:
      return simTimePartsScratch[0].concat(" ", simTimePartsScratch[1]);
    case 3:
      return simTimePartsScratch[0].concat(
        " ",
        simTimePartsScratch[1],
        " ",
        simTimePartsScratch[2],
      );
    case 4:
      return simTimePartsScratch[0].concat(
        " ",
        simTimePartsScratch[1],
        " ",
        simTimePartsScratch[2],
        " ",
        simTimePartsScratch[3],
      );
    default:
      return simTimePartsScratch[0].concat(
        " ",
        simTimePartsScratch[1],
        " ",
        simTimePartsScratch[2],
        " ",
        simTimePartsScratch[3],
        " ",
        simTimePartsScratch[4],
      );
  }
}

function formatTwoDigit(n: number): string {
  return n < 10 ? "0".concat(n.toString()) : n.toString();
}
