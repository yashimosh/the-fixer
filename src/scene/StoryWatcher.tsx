// StoryWatcher — runs in the scene tree, watches the truck's z position,
// fires position-triggered story beats and the ending transition.
//
// Lives inside <Canvas> so it can use useFrame, but renders nothing visible.
// Reads truckRef directly to avoid prop drilling.
//
// Beat firing uses a `fired[]` array of booleans indexed against the
// incident's beats array. Each beat fires once when the truck z first
// crosses its triggerZ. The beat text is shown via a transient UI flash
// — for now we use a Zustand-backed flash slot the HUD reads.
//
// Ending: when truck z exceeds END_Z and the run has been going for at
// least END_MIN_SECONDS, the run ends with the appropriate cargo-state
// variant. END_MIN_SECONDS prevents the player teleporting through the
// world from skipping the experience.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { truckRef } from "./truckRef";
import { useGame } from "../store";
import { shake } from "./shakeRef";

const END_Z            = 120;   // truck-z threshold for crossing into "after"
const END_MIN_SECONDS  = 8;     // floor on run duration before ending fires
const END_DELAY_AFTER  = 4;     // additional seconds past END_Z before card

export default function StoryWatcher() {
  const fired = useRef<Set<number>>(new Set());
  const runStartedAt = useRef<number | null>(null);
  const arrivedAt    = useRef<number | null>(null);

  useFrame((state) => {
    const rb = truckRef.current;
    if (!rb) return;

    const game = useGame.getState();
    if (game.phase !== "running") return;

    // Capture run-start time the first frame phase becomes "running"
    if (runStartedAt.current === null) runStartedAt.current = state.clock.elapsedTime;

    const tz = rb.translation().z;
    const now = state.clock.elapsedTime;

    // ── Mid-run beats ────────────────────────────────────────────────────
    game.incident.beats.forEach((beat, i) => {
      if (fired.current.has(i)) return;
      if (tz >= beat.triggerZ) {
        fired.current.add(i);
        useGame.getState().showBeat(beat.text);
        shake.countdown = 0.38; // brief camera jolt so the beat has a physical marker
      }
    });

    // ── Ending sequencing ────────────────────────────────────────────────
    if (tz >= END_Z && arrivedAt.current === null) {
      arrivedAt.current = now;
    }
    if (
      arrivedAt.current !== null &&
      now - arrivedAt.current >= END_DELAY_AFTER &&
      now - (runStartedAt.current ?? 0) >= END_MIN_SECONDS
    ) {
      const { cargoSecured, cargoTotal, endRun } = useGame.getState();
      let variant: "clean" | "partial" | "failed";
      if (cargoSecured >= cargoTotal)      variant = "clean";
      else if (cargoSecured > 0)           variant = "partial";
      else                                 variant = "failed";
      endRun(variant);
    }
  });

  return null;
}
