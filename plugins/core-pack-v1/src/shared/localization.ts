import type { ExternalLocale } from "@solitude/plugin-api";

export interface PluginLocaleOption {
  readonly label: string;
  readonly locale: ExternalLocale;
}

export interface PluginLocalization {
  readonly locale: ExternalLocale;
  readonly localeOptions: readonly PluginLocaleOption[];
  readonly htmlLang: string;
  readonly formatDistance: (distanceMeters: number) => string;
  readonly formatSpeed: (speedMps: number) => string;
  readonly formatDeltaV: (speedMps: number) => string;
  readonly formatFixed: (value: number, fractionDigits: number) => string;
  readonly formatMessage: (
    template: string,
    params: Readonly<Record<string, string>>,
  ) => string;
}

const oneAstronomicalUnitMeters = 149_597_870_700;
const oneKilometerMeters = 1000;
const onePercentLightSpeedMps = 2_997_924.58;

export const pluginLocaleOptions: readonly PluginLocaleOption[] = [
  { locale: "en", label: "English" },
  { locale: "es", label: "Español" },
  { locale: "fr", label: "Français" },
];

export function createPluginLocalization(
  locale: ExternalLocale,
): PluginLocalization {
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: false,
  });
  const decimal = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    useGrouping: false,
  });
  const fixed0 = createFixedFormatter(locale, 0);
  const fixed1 = createFixedFormatter(locale, 1);
  const fixed2 = createFixedFormatter(locale, 2);
  const fixed3 = createFixedFormatter(locale, 3);

  return {
    locale,
    localeOptions: pluginLocaleOptions,
    htmlLang: locale.slice(0, 2),
    formatDistance: (distanceMeters) =>
      formatDistance(distanceMeters, number, decimal),
    formatSpeed: (speedMps) => formatSpeed(speedMps, number, decimal),
    formatDeltaV: (speedMps) => formatDeltaV(speedMps, decimal),
    formatFixed: (value, fractionDigits) =>
      formatFixed(value, fractionDigits, fixed0, fixed1, fixed2, fixed3),
    formatMessage,
  };
}

function formatMessage(
  template: string,
  params: Readonly<Record<string, string>>,
): string {
  let formatted = template;
  for (const [key, value] of Object.entries(params)) {
    formatted = formatted.split(`{${key}}`).join(value);
  }
  return formatted;
}

function formatDistance(
  distanceMeters: number,
  number: Intl.NumberFormat,
  decimal: Intl.NumberFormat,
): string {
  if (distanceMeters >= oneAstronomicalUnitMeters) {
    return `${decimal.format(distanceMeters / oneAstronomicalUnitMeters)} AU`;
  }
  if (distanceMeters >= oneKilometerMeters) {
    return `${number.format(Math.round(distanceMeters / oneKilometerMeters))} km`;
  }
  return `${number.format(distanceMeters)} m`;
}

function formatSpeed(
  speedMps: number,
  number: Intl.NumberFormat,
  decimal: Intl.NumberFormat,
): string {
  if (speedMps >= onePercentLightSpeedMps) {
    return `${decimal.format(speedMps / onePercentLightSpeedMps)}% C`;
  }
  return `${number.format(Math.round(speedMps * 3.6))} km/h`;
}

function formatDeltaV(speedMps: number, decimal: Intl.NumberFormat): string {
  if (speedMps >= oneKilometerMeters) {
    return `${decimal.format(speedMps / oneKilometerMeters)} km/s`;
  }
  return `${decimal.format(speedMps)} m/s`;
}

function createFixedFormatter(
  locale: ExternalLocale,
  fractionDigits: number,
): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    useGrouping: false,
  });
}

function formatFixed(
  value: number,
  fractionDigits: number,
  fixed0: Intl.NumberFormat,
  fixed1: Intl.NumberFormat,
  fixed2: Intl.NumberFormat,
  fixed3: Intl.NumberFormat,
): string {
  switch (fractionDigits) {
    case 0:
      return fixed0.format(value);
    case 1:
      return fixed1.format(value);
    case 2:
      return fixed2.format(value);
    case 3:
      return fixed3.format(value);
    default:
      throw new Error(
        `Unsupported fixed precision: ${fractionDigits.toString()}`,
      );
  }
}
