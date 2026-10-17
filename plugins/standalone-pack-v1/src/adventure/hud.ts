import {
  createHudPanelCapability,
  hudHighlightCapability,
  type ExternalHudHighlightProvider,
} from "@solitude/plugin-api/hud";
import type {
  AdventureGuidance,
  AdventureInstrumentId,
} from "@solitude/plugin-api/my-first-orbit";

const instrumentKeys: Record<AdventureInstrumentId, string> = {
  "adventure.orbit.primary": "orbit.primary",
  "adventure.orbit.periapsisAltitude": "orbit.periapsisAltitude",
  "adventure.orbit.apoapsisAltitude": "orbit.apoapsisAltitude",
  "adventure.earth.altitude": "orbit.altitude",
  "adventure.flight.progradeAlignment": "adventure.alignment",
  "adventure.flight.propulsion": "adventure.propulsion",
  "adventure.objective.coast": "adventure.coast",
};

export function createAdventureHudCapabilities(guidance: AdventureGuidance) {
  const highlight: ExternalHudHighlightProvider = {
    isHighlighted: (key) => {
      if (!guidance.visible) return false;
      if (key === "autopilot.mode")
        return guidance.cue === "align" || guidance.cue === "orientOrbit";
      for (const instrument of guidance.instruments) {
        if (instrumentKeys[instrument.id] === key) return instrument.emphasized;
      }
      return false;
    },
  };
  return [
    { id: hudHighlightCapability, value: highlight },
    createHudPanelCapability({
      writeHud: (grid) => {
        if (!guidance.visible) return;
        for (const instrument of guidance.instruments) {
          if (
            instrument.id === "adventure.flight.progradeAlignment" ||
            instrument.id === "adventure.flight.propulsion" ||
            instrument.id === "adventure.objective.coast"
          ) {
            grid.addLine(
              "center",
              instrumentKeys[instrument.id],
              `${instrument.label}: ${instrument.text}`,
            );
          }
        }
      },
    }),
  ];
}
