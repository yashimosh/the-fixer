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

  // Cargo state — decrements when the player drives too fast at risk beats.
  // Determines which ending variant fires at END_Z.
  cargoTotal:    number;
  cargoSecured:  number;
  loseCargoItem: () => void;

  // Transient HUD flash text (mid-run beats land here; HUD reads it).
  // Bumping `flashId` causes the HUD to re-trigger its fade-in animation
  // even when the same beat text would otherwise be a no-op update.
  flashText: string | null;
  flashId:   number;

  // Phase transitions
  startRun: () => void;
  endRun:   (state: "clean" | "partial" | "failed") => void;
  endingState: "clean" | "partial" | "failed" | null;

  // Mid-run beat broadcasting
  showBeat: (text: string) => void;
  clearFlash: () => void;

  // Live speed (km/h) — updated from Truck.tsx every ~5 frames.
  speedKmh: number;
  setSpeed: (kmh: number) => void;
}

export const useGame = create<GameState>((set, get) => ({
  incident:     CANONICAL_2017,
  phase:        "intro",
  cargoTotal:   4,
  cargoSecured: 4,
  endingState:  null,
  flashText:    null,
  flashId:      0,

  loseCargoItem: () => set((s) => ({ cargoSecured: Math.max(0, s.cargoSecured - 1) })),

  startRun: () => set({ phase: "running" }),
  endRun:   (s) => set({ phase: "ended", endingState: s }),

  showBeat: (text) => set({ flashText: text, flashId: get().flashId + 1 }),
  clearFlash: () => set({ flashText: null }),

  speedKmh: 0,
  setSpeed: (kmh) => set({ speedKmh: kmh }),
}));
