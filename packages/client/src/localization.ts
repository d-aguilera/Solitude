import {
  createSolitudeLocalization,
  type SolitudeLocale,
  type SolitudeLocalization,
} from "@solitude/sim/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type ClientMessageTable = typeof enMessages;

export interface ClientLocalization extends SolitudeLocalization {
  readonly common: {
    readonly none: string;
  };
  readonly lobby: {
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
    gameSummary: (summary: {
      readonly assignedEntityIds: readonly string[];
      readonly availableEntityIds: readonly string[];
      readonly gameId: string;
      readonly tick: number;
    }) => string;
  };
  readonly remoteIdentity: {
    readonly entityPrefix: string;
    readonly gameNone: string;
    readonly gamePrefix: string;
  };
  readonly remoteRuntime: {
    readonly fpsPrefix: string;
    readonly timePrefix: string;
  };
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<SolitudeLocale, ClientMessageTable>;

export function createClientLocalization(
  locale: SolitudeLocale,
): ClientLocalization {
  const base = createSolitudeLocalization(locale);
  const messages = messagesByLocale[locale];
  return {
    ...base,
    common: {
      none: messages["common.none"],
    },
    lobby: {
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
        base.formatMessage(messages["lobby.gameSummary"], {
          assigned: formatEntityList(
            summary.assignedEntityIds,
            messages["common.none"],
          ),
          available: formatEntityList(
            summary.availableEntityIds,
            messages["common.none"],
          ),
          gameId: summary.gameId,
          tick: base.formatFixed(summary.tick, 0),
        }),
    },
    remoteIdentity: {
      entityPrefix: messages["remoteIdentity.entityPrefix"],
      gameNone: messages["remoteIdentity.gameNone"],
      gamePrefix: messages["remoteIdentity.gamePrefix"],
    },
    remoteRuntime: {
      fpsPrefix: messages["remoteRuntime.fpsPrefix"],
      timePrefix: messages["remoteRuntime.timePrefix"],
    },
  };
}

function formatEntityList(
  entityIds: readonly string[],
  emptyText: string,
): string {
  return entityIds.length === 0 ? emptyText : entityIds.join(", ");
}
