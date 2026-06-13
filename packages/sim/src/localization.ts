import type { RuntimeOptions } from "@solitude/engine/plugin";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

export type SolitudeLocale = "en" | "es" | "fr";

export interface SolitudeLocaleOption {
  readonly label: string;
  readonly locale: SolitudeLocale;
}

export interface SolitudeLocalization {
  readonly htmlLang: string;
  readonly hud: SolitudeHudMessages;
  readonly lobby: SolitudeLobbyMessages;
  readonly locale: SolitudeLocale;
  readonly localeOptions: readonly SolitudeLocaleOption[];
  readonly formatDeltaV: (speedMps: number) => string;
  readonly formatDistance: (distanceMeters: number) => string;
  readonly formatEntityName: (
    entityId: string,
    explicitDisplayName: string | undefined,
  ) => string;
  readonly formatFixed: (value: number, fractionDigits: number) => string;
  readonly formatSpeed: (speedMps: number) => string;
}

export interface SolitudeLobbyMessages {
  readonly createGame: string;
  readonly creatingGame: string;
  readonly createFailed: string;
  readonly full: string;
  readonly gameCreated: string;
  readonly gamesHeading: string;
  readonly join: string;
  readonly languageLabel: string;
  readonly noGamesYet: string;
  readonly ready: string;
  readonly refreshFailed: string;
  readonly refreshingGames: string;
  gameSummary: (summary: SolitudeLobbyGameSummaryText) => string;
}

export interface SolitudeLobbyGameSummaryText {
  readonly assignedEntityIds: readonly string[];
  readonly availableEntityIds: readonly string[];
  readonly gameId: string;
  readonly tick: number;
}

export interface SolitudeHudMessages {
  readonly apoapsisTimeEmpty: string;
  readonly autopilotBody: string;
  readonly autopilotCircleNow: string;
  readonly autopilotPrefix: string;
  readonly autopilotVelocity: string;
  readonly deltaVRadialPrefix: string;
  readonly deltaVTangentialPrefix: string;
  readonly eccentricityPrefix: string;
  readonly fpsPrefix: string;
  readonly gameNone: string;
  readonly gamePrefix: string;
  readonly inclinationPrefix: string;
  readonly orbitBound: string;
  readonly orbitEscape: string;
  readonly orbitPrefix: string;
  readonly peApEmpty: string;
  readonly periapsisTimeEmpty: string;
  readonly paused: string;
  readonly profiling: string;
  readonly rcsPrefix: string;
  readonly speedPrefix: string;
  readonly thrustPrefix: string;
  readonly timePrefix: string;
  readonly timeScalePrefix: string;
  readonly entityPrefix: string;
  readonly none: string;
  readonly outbound: string;
  readonly inbound: string;
  readonly prograde: string;
  readonly retrograde: string;
  apoapsisIn: (time: string) => string;
  distanceLabel: (distance: string) => string;
  periapsisApoapsis: (periapsis: string, apoapsis: string) => string;
  periapsisIn: (time: string) => string;
  velocityLabel: (speed: string) => string;
}

type SolitudeMessageTable = typeof enMessages;
type MessageParams = Readonly<Record<string, string>>;

const localeRuntimeOptionKey = "locale";
const oneAstronomicalUnitMeters = 149_597_870_700;
const oneKilometerMeters = 1000;
const onePercentLightSpeedMps = 2_997_924.58;
const localeMessagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<SolitudeLocale, SolitudeMessageTable>;

export const solitudeLocaleOptions: readonly SolitudeLocaleOption[] = [
  { locale: "en", label: enMessages["locale.label"] },
  { locale: "es", label: esMessages["locale.label"] },
  { locale: "fr", label: frMessages["locale.label"] },
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
  const messages = localeMessagesByLocale[locale];
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
    lobby: createLobbyMessages(messages, number),
    hud: createHudMessages(messages),
    formatDistance: (distanceMeters) =>
      formatDistance(distanceMeters, number, decimal),
    formatSpeed: (speedMps) => formatSpeed(speedMps, number, decimal),
    formatDeltaV: (speedMps) => formatDeltaV(speedMps, decimal),
    formatFixed: (value, fractionDigits) =>
      formatFixed(value, fractionDigits, fixed0, fixed1, fixed2, fixed3),
    formatEntityName: (entityId, explicitDisplayName) =>
      formatEntityName(messages, entityId, explicitDisplayName),
  };
}

export function readLocaleRuntimeOption(
  runtimeOptions: RuntimeOptions = {},
): SolitudeLocale {
  return resolveSolitudeLocale(runtimeOptions);
}

function createLobbyMessages(
  messages: SolitudeMessageTable,
  number: Intl.NumberFormat,
): SolitudeLobbyMessages {
  return {
    createGame: messages["lobby.createGame"],
    creatingGame: messages["lobby.creatingGame"],
    createFailed: messages["lobby.createFailed"],
    full: messages["lobby.full"],
    gameCreated: messages["lobby.gameCreated"],
    gamesHeading: messages["lobby.gamesHeading"],
    join: messages["lobby.join"],
    languageLabel: messages["lobby.languageLabel"],
    noGamesYet: messages["lobby.noGamesYet"],
    ready: messages["lobby.ready"],
    refreshFailed: messages["lobby.refreshFailed"],
    refreshingGames: messages["lobby.refreshingGames"],
    gameSummary: (summary) =>
      formatMessage(messages["lobby.gameSummary"], {
        assigned: formatEntityList(
          summary.assignedEntityIds,
          messages["hud.none"],
        ),
        available: formatEntityList(
          summary.availableEntityIds,
          messages["hud.none"],
        ),
        gameId: summary.gameId,
        tick: number.format(summary.tick),
      }),
  };
}

function createHudMessages(
  messages: SolitudeMessageTable,
): SolitudeHudMessages {
  return {
    apoapsisTimeEmpty: messages["hud.apoapsisTimeEmpty"],
    autopilotBody: messages["hud.autopilotBody"],
    autopilotCircleNow: messages["hud.autopilotCircleNow"],
    autopilotPrefix: messages["hud.autopilotPrefix"],
    autopilotVelocity: messages["hud.autopilotVelocity"],
    deltaVRadialPrefix: messages["hud.deltaVRadialPrefix"],
    deltaVTangentialPrefix: messages["hud.deltaVTangentialPrefix"],
    eccentricityPrefix: messages["hud.eccentricityPrefix"],
    entityPrefix: messages["hud.entityPrefix"],
    fpsPrefix: messages["hud.fpsPrefix"],
    gameNone: messages["hud.gameNone"],
    gamePrefix: messages["hud.gamePrefix"],
    inbound: messages["hud.inbound"],
    inclinationPrefix: messages["hud.inclinationPrefix"],
    none: messages["hud.none"],
    orbitBound: messages["hud.orbitBound"],
    orbitEscape: messages["hud.orbitEscape"],
    orbitPrefix: messages["hud.orbitPrefix"],
    outbound: messages["hud.outbound"],
    paused: messages["hud.paused"],
    peApEmpty: messages["hud.peApEmpty"],
    periapsisTimeEmpty: messages["hud.periapsisTimeEmpty"],
    profiling: messages["hud.profiling"],
    prograde: messages["hud.prograde"],
    rcsPrefix: messages["hud.rcsPrefix"],
    retrograde: messages["hud.retrograde"],
    speedPrefix: messages["hud.speedPrefix"],
    thrustPrefix: messages["hud.thrustPrefix"],
    timePrefix: messages["hud.timePrefix"],
    timeScalePrefix: messages["hud.timeScalePrefix"],
    apoapsisIn: (time) => formatMessage(messages["hud.apoapsisIn"], { time }),
    distanceLabel: (distance) =>
      formatMessage(messages["hud.distanceLabel"], { distance }),
    periapsisApoapsis: (periapsis, apoapsis) =>
      formatMessage(messages["hud.periapsisApoapsis"], {
        apoapsis,
        periapsis,
      }),
    periapsisIn: (time) => formatMessage(messages["hud.periapsisIn"], { time }),
    velocityLabel: (speed) =>
      formatMessage(messages["hud.velocityLabel"], { speed }),
  };
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

function formatEntityList(
  entityIds: readonly string[],
  emptyText: string,
): string {
  return entityIds.length === 0 ? emptyText : entityIds.join(", ");
}

function formatMessage(template: string, params: MessageParams): string {
  let formatted = template;
  for (const [key, value] of Object.entries(params)) {
    formatted = formatted.split("{".concat(key, "}")).join(value);
  }
  return formatted;
}

function formatEntityName(
  messages: SolitudeMessageTable,
  entityId: string,
  explicitDisplayName: string | undefined,
): string {
  if (explicitDisplayName) return explicitDisplayName;
  return (
    (messages as Readonly<Record<string, string>>)[
      "entityName.".concat(entityId)
    ] ?? displayNameFromEntityId(entityId)
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
