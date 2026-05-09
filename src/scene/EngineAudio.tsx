// EngineAudio — procedural engine sound via Tone.js.
//
// Two detuned sawtooth oscillators + filtered brown noise simulate a diesel
// engine: sawtooth harmonics give the characteristic roughness, noise adds
// road texture, the lowpass filter opens with RPM so the engine sounds
// "breathier" at speed.
//
// Tone.start() MUST be called inside a user gesture before this component
// can produce sound. StoryCard calls it on the DRIVE button click, which
// fires well before the first frame with phase === "running".
//
// The chain intentionally skips Tone.Transport — we only need continuous
// synthesis driven by per-frame velocity data, not scheduled sequences.

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as Tone from "tone";
import { truckRef } from "./truckRef";
import { useGame } from "../store";

const MAX_SPEED = 11; // m/s — must match Truck.tsx MAX_SPEED

export default function EngineAudio() {
  const chain = useRef<{
    osc1:        Tone.Oscillator;
    osc2:        Tone.Oscillator;
    noise:       Tone.Noise;
    filter:      Tone.Filter;
    noiseFilter: Tone.Filter;
    master:      Tone.Gain;
  } | null>(null);

  const started  = useRef(false);
  const starting = useRef(false);

  useEffect(() => {
    // Build graph — don't start oscillators yet; that waits for phase change.
    const filter      = new Tone.Filter({ type: "lowpass",  frequency: 280, Q: 1 });
    const noiseFilter = new Tone.Filter({ type: "bandpass", frequency: 160, Q: 3 });
    const master      = new Tone.Gain(0);   // starts silent

    const osc1  = new Tone.Oscillator({ type: "sawtooth", frequency: 45 });
    const osc2  = new Tone.Oscillator({ type: "sawtooth", frequency: 47 }); // ~50 cents flat
    const noise = new Tone.Noise("brown");

    // Signal routing
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(master);

    noise.connect(noiseFilter);
    noiseFilter.connect(master);

    master.toDestination();

    chain.current = { osc1, osc2, noise, filter, noiseFilter, master };

    return () => {
      try { osc1.stop();  } catch { /* already stopped */ }
      try { osc2.stop();  } catch { /* already stopped */ }
      try { noise.stop(); } catch { /* already stopped */ }
      osc1.dispose();
      osc2.dispose();
      noise.dispose();
      filter.dispose();
      noiseFilter.dispose();
      master.dispose();
    };
  }, []);

  useFrame((_, dt) => {
    const rb  = truckRef.current;
    const ch  = chain.current;
    if (!rb || !ch) return;

    const phase = useGame.getState().phase;

    if (phase === "running") {
      // ── Start oscillators once, after AudioContext is running ──────────
      if (!started.current && !starting.current) {
        starting.current = true;
        Tone.start()
          .then(() => {
            if (!chain.current) return;
            chain.current.osc1.start();
            chain.current.osc2.start();
            chain.current.noise.start();
            started.current  = true;
            starting.current = false;
          })
          .catch(() => { starting.current = false; });
      }

      if (!started.current) return;

      // ── Modulate chain with current speed ─────────────────────────────
      const vel   = rb.linvel();
      const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      const t     = Math.min(1, speed / MAX_SPEED);   // 0 → 1

      // Pitch: 45 Hz idle (roughly 800 RPM) → 140 Hz (roughly 2500 RPM)
      const freq = 45 + t * 95;
      ch.osc1.frequency.rampTo(freq,         0.08);
      ch.osc2.frequency.rampTo(freq * 1.018, 0.08);

      // Filter opens as RPM rises — punch through on the mid-range at speed
      ch.filter.frequency.rampTo(280 + t * 1100, 0.12);

      // Noise centre rises with filter for road texture tracking
      ch.noiseFilter.frequency.rampTo(160 + t * 200, 0.12);

      // Master volume ramps in on game start, then scales slightly with speed
      const targetGain = 0.14 + t * 0.06;
      ch.master.gain.rampTo(targetGain, 0.15);

    } else if (started.current) {
      // Fade to silence when not running (phase = intro / ended)
      ch.master.gain.rampTo(0, 0.6);
      void dt; // suppress lint
    }
  });

  return null;
}
