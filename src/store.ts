// store — game state via Zustand.
//
// What lives here: things the UI tree and the scene tree both need to
// react to. Currently: story phase, cargo state placeholder, current
// incident.
//
// What does NOT live here: per-frame transforms (those are in the scene
// graph), input keys (those are in input/useKeys), or audio state
// (Howler manages its own).

import { create } from "zustand";
import type { IncidentText } from "./story/incidents";
import { CANONICAL_2017 } from "./story/incidents";

export type StoryPhase = "intro" | "running" | "ended";

export interface GameState {
  // Current incident (canonical 2017 Mosul for now)
  incident: IncidentText;

  // Where in the story we are
  phase: StoryPhase;

  // Cargo state (placeholder — wired up when cargo physics exist)
  cargoTotal:    number;
  cargoSecured:  number;

  // Phase transitions
  startRun: () => void;
  endRun:   (state: "clean" | "partial" | "failed") => void;
  endingState: "clean" | "partial" | "failed" | null;
}

export const useGame = create<GameState>((set) => ({
  incident:     CANONICAL_2017,
  phase:        "intro",
  cargoTotal:   4,
  cargoSecured: 4,
  endingState:  null,

  startRun: () => set({ phase: "running" }),
  endRun: (s) => set({ phase: "ended", endingState: s }),
}));
