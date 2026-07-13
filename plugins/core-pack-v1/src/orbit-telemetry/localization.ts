import type { ExternalLocale } from "@solitude/plugin-api/localization";
import {
  createPluginLocalization,
  type PluginLocalization,
} from "../shared/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type OrbitTelemetryMessageTable = typeof enMessages;

export interface OrbitTelemetryLocalization extends PluginLocalization {
  readonly apoapsisTimeEmpty: string;
  readonly deltaVRadialPrefix: string;
  readonly deltaVTangentialPrefix: string;
  readonly distancePrefix: string;
  readonly eccentricityPrefix: string;
  readonly inbound: string;
  readonly inclinationPrefix: string;
  readonly orbitBound: string;
  readonly orbitEscape: string;
  readonly orbitPrefix: string;
  readonly outbound: string;
  readonly peApEmpty: string;
  readonly periapsisTimeEmpty: string;
  readonly prograde: string;
  readonly retrograde: string;
  apoapsisIn: (time: string) => string;
  periapsisApoapsis: (periapsis: string, apoapsis: string) => string;
  periapsisIn: (time: string) => string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<ExternalLocale, OrbitTelemetryMessageTable>;

export function createOrbitTelemetryLocalization(
  locale: ExternalLocale,
): OrbitTelemetryLocalization {
  const base = createPluginLocalization(locale);
  const messages = messagesByLocale[locale];
  return {
    ...base,
    apoapsisTimeEmpty: messages.apoapsisTimeEmpty,
    deltaVRadialPrefix: messages.deltaVRadialPrefix,
    deltaVTangentialPrefix: messages.deltaVTangentialPrefix,
    distancePrefix: messages.distancePrefix,
    eccentricityPrefix: messages.eccentricityPrefix,
    inbound: messages.inbound,
    inclinationPrefix: messages.inclinationPrefix,
    orbitBound: messages.orbitBound,
    orbitEscape: messages.orbitEscape,
    orbitPrefix: messages.orbitPrefix,
    outbound: messages.outbound,
    peApEmpty: messages.peApEmpty,
    periapsisTimeEmpty: messages.periapsisTimeEmpty,
    prograde: messages.prograde,
    retrograde: messages.retrograde,
    apoapsisIn: (time) => base.formatMessage(messages.apoapsisIn, { time }),
    periapsisApoapsis: (periapsis, apoapsis) =>
      base.formatMessage(messages.periapsisApoapsis, { apoapsis, periapsis }),
    periapsisIn: (time) => base.formatMessage(messages.periapsisIn, { time }),
  };
}
