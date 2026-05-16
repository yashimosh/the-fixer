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
import { trackBeatRead, trackCargoLost, trackRunComplete } from "../telemetry";

const END_Z            = 120;   // truck-z threshold for crossing into "after"
const END_MIN_SECONDS  = 8;     // floor on run duration before ending fires
const END_DELAY_AFTER  = 4;     // additional seconds past END_Z before card

// Cargo-risk threshold — m/s. Driving faster than this when a cargoRisk
// beat fires drops one cargo item. 8 m/s ≈ 29 km/h; achievable at normal
// pace, punishing only if the player is pushing speed through narrative beats.
const CARGO_RISK_SPEED = 8;

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

        // Telemetry — record that this beat fired. Gives real player data on
        // which beats get read vs driven past (no dwell-time metric needed;
        // the beat fired = the text appeared on screen).
        trackBeatRead(i, beat.text);

        // Cargo-risk check — if this beat is a risk moment and the player is
        // driving above threshold, one cargo item is lost.
        // Loss is signalled by a smaller camera shake + a diegetic flash line
        // so the player has a real-time signal, not just a dimmed dot post-run.
        if (beat.cargoRisk) {
          const vel = rb.linvel();
          const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
          if (speed > CARGO_RISK_SPEED) {
            useGame.getState().loseCargoItem();
            shake.countdown = 0.18; // shorter/smaller than beat shake (0.38)
            trackCargoLost(i, Math.round(speed * 3.6)); // speed in km/h for telemetry
            // Diegetic loss line — fires immediately after the beat text.
            // Timeout lets the beat text settle for 1s before the loss lands.
            window.setTimeout(() => {
              useGame.getState().showBeat("Something shifts in the back. You hear it.");
            }, 1200);
          }
        }
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
      else if (cargoSecured > 1)           variant = "partial";
      else                                 variant = "failed";
      // Note: cargoSecured can reach 1 (lose all 3 risk beats) → "failed".
      // cargoSecured=0 is unreachable with 3 risk beats; ≤1 covers the floor.
      const runDuration = runStartedAt.current !== null
        ? Math.round(now - runStartedAt.current)
        : 0;
      trackRunComplete(variant, cargoSecured, runDuration);
      endRun(variant);
    }
  });

  return null;
}
