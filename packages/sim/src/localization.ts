import type {
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
  RuntimeOptions,
} from "@solitude/engine/plugin";

export type SolitudeLocale = "en" | "es" | "fr";

export interface SolitudeLocaleOption {
  readonly label: string;
  readonly locale: SolitudeLocale;
}

export interface SolitudeLocalization {
  readonly locale: SolitudeLocale;
  readonly localeOptions: readonly SolitudeLocaleOption[];
  readonly htmlLang: string;
  readonly formatDistance: (distanceMeters: number) => string;
  readonly formatSpeed: (speedMps: number) => string;
  readonly formatDeltaV: (speedMps: number) => string;
  readonly formatFixed: (value: number, fractionDigits: number) => string;
  readonly formatMessage: (template: string, params: MessageParams) => string;
}

export interface EntityNameProvider {
  formatEntityName: (
    entityId: string,
    explicitDisplayName: string | undefined,
  ) => string | null;
}

export type MessageParams = Readonly<Record<string, string>>;

export const entityNameProviderCapability = "solitude.entityNameProvider.v1";

const localeRuntimeOptionKey = "locale";
const oneAstronomicalUnitMeters = 149_597_870_700;
const oneKilometerMeters = 1000;
const onePercentLightSpeedMps = 2_997_924.58;

export const solitudeLocaleOptions: readonly SolitudeLocaleOption[] = [
  { locale: "en", label: "English" },
  { locale: "es", label: "Español" },
  { locale: "fr", label: "Français" },
];

const supportedLocales = solitudeLocaleOptions.map(({ locale }) => locale);

export function resolveSolitudeLocale(
  runtimeOptions: RuntimeOptions = {},
  preferredLocales: readonly string[] = [],
): SolitudeLocale {
  return (
    findSupportedLocale(runtimeOptions[localeRuntimeOptionKey]) ??
    findFirstSupportedLocale(preferredLocales) ??
    "en"
  );
}

export function createRuntimeOptionsWithResolvedLocale(
  runtimeOptions: RuntimeOptions = {},
  preferredLocales: readonly string[] = [],
): RuntimeOptions {
  return {
    ...runtimeOptions,
    [localeRuntimeOptionKey]: resolveSolitudeLocale(
      runtimeOptions,
      preferredLocales,
    ),
  };
}

export function createSolitudeLocalization(
  locale: SolitudeLocale,
): SolitudeLocalization {
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
    localeOptions: solitudeLocaleOptions,
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

export function readLocaleRuntimeOption(
  runtimeOptions: RuntimeOptions = {},
): SolitudeLocale {
  return resolveSolitudeLocale(runtimeOptions);
}

export function createEntityNameProvider(
  provider: EntityNameProvider,
): PluginCapabilityProvider {
  return {
    id: entityNameProviderCapability,
    value: provider,
  };
}

export function formatEntityName(
  capabilityRegistry: PluginCapabilityRegistry,
  entityId: string,
  explicitDisplayName: string | undefined,
): string {
  if (explicitDisplayName) return explicitDisplayName;

  for (const provider of capabilityRegistry.getAll(
    entityNameProviderCapability,
  )) {
    if (!isEntityNameProvider(provider)) continue;
    const formatted = provider.formatEntityName(entityId, explicitDisplayName);
    if (formatted != null) return formatted;
  }

  return displayNameFromEntityId(entityId);
}

function findFirstSupportedLocale(
  locales: readonly string[],
): SolitudeLocale | null {
  for (const locale of locales) {
    const supported = findSupportedLocale(locale);
    if (supported) return supported;
  }
  return null;
}

function findSupportedLocale(
  locale: string | undefined,
): SolitudeLocale | null {
  if (!locale) return null;
  if (isSupportedLocale(locale)) return locale;
  const language = locale.split("-")[0]?.toLowerCase();
  if (language === "es") return "es";
  if (language === "fr") return "fr";
  if (language === "en") return "en";
  return null;
}

function isSupportedLocale(locale: string): locale is SolitudeLocale {
  return supportedLocales.includes(locale as SolitudeLocale);
}

function formatMessage(template: string, params: MessageParams): string {
  let formatted = template;
  for (const [key, value] of Object.entries(params)) {
    formatted = formatted.split("{".concat(key, "}")).join(value);
  }
  return formatted;
}

function isEntityNameProvider(value: unknown): value is EntityNameProvider {
  const candidate = value as Partial<EntityNameProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.formatEntityName === "function"
  );
}

function displayNameFromEntityId(id: string): string {
  const separatorIndex = id.lastIndexOf(":");
  const raw = separatorIndex >= 0 ? id.slice(separatorIndex + 1) : id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatDistance(
  distanceMeters: number,
  number: Intl.NumberFormat,
  decimal: Intl.NumberFormat,
): string {
  if (distanceMeters >= oneAstronomicalUnitMeters) {
    return decimal
      .format(distanceMeters / oneAstronomicalUnitMeters)
      .concat(" AU");
  }
  if (distanceMeters >= oneKilometerMeters) {
    return number
      .format(Math.round(distanceMeters / oneKilometerMeters))
      .concat(" km");
  }
  return number.format(distanceMeters).concat(" m");
}

function formatSpeed(
  speedMps: number,
  number: Intl.NumberFormat,
  decimal: Intl.NumberFormat,
): string {
  if (speedMps >= onePercentLightSpeedMps) {
    return decimal.format(speedMps / onePercentLightSpeedMps).concat("% C");
  }
  return number.format(Math.round(speedMps * 3.6)).concat(" km/h");
}

function formatDeltaV(speedMps: number, decimal: Intl.NumberFormat): string {
  if (speedMps >= oneKilometerMeters) {
    return decimal.format(speedMps / oneKilometerMeters).concat(" km/s");
  }
  return decimal.format(speedMps).concat(" m/s");
}

function createFixedFormatter(
  locale: SolitudeLocale,
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
        "Unsupported fixed precision: ".concat(fractionDigits.toString()),
      );
  }
}
