// AmbientAudio — environmental sound layer for the West Mosul run.
//
// Two noise layers running under the engine:
//
//   Wind   — pink noise band-passed to a soft whoosh (200–800 Hz).
//            Quiet by default, barely perceptible under the engine.
//            West Mosul in June has a persistent low wind off the desert.
//
//   Rumble — brown noise low-passed to sub-80 Hz.
//            Represents what the truck body transfers from the road:
//            distant machinery, demolition vibration, the city not being quiet.
//
// Neither layer is musical or signalling — they're room tone.
// They should be felt more than heard.
//
// Tone.start() is called by StoryCard on DRIVE click, always before
// phase becomes "running". This component is safe to start without
// a second gesture.

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as Tone from "tone";
import { useGame } from "../store";

export default function AmbientAudio() {
  const chain = useRef<{
    windNoise:    Tone.Noise;
    windFilter:   Tone.Filter;
    windGain:     Tone.Gain;
    rumbleNoise:  Tone.Noise;
    rumbleFilter: Tone.Filter;
    rumbleGain:   Tone.Gain;
    master:       Tone.Gain;
  } | null>(null);

  const started  = useRef(false);
  const starting = useRef(false);

  useEffect(() => {
    // Wind — pink noise bandpassed to a soft 200–800 Hz whisper.
    const windNoise   = new Tone.Noise("pink");
    const windFilter  = new Tone.Filter({ type: "bandpass", frequency: 380, Q: 0.7 });
    const windGain    = new Tone.Gain(0.038);

    // Rumble — brown noise low-passed below 80 Hz.
    // Brown noise is already bass-heavy; the filter rolls off the mid crackle.
    const rumbleNoise  = new Tone.Noise("brown");
    const rumbleFilter = new Tone.Filter({ type: "lowpass", frequency: 75 });
    const rumbleGain   = new Tone.Gain(0.09);

    // Master bus starts silent — fades in on phase change.
    const master = new Tone.Gain(0);

    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);

    rumbleNoise.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(master);

    master.toDestination();

    chain.current = {
      windNoise, windFilter, windGain,
      rumbleNoise, rumbleFilter, rumbleGain,
      master,
    };

    return () => {
      try { windNoise.stop();   } catch { /* already stopped */ }
      try { rumbleNoise.stop(); } catch { /* already stopped */ }
      windNoise.dispose();
      windFilter.dispose();
      windGain.dispose();
      rumbleNoise.dispose();
      rumbleFilter.dispose();
      rumbleGain.dispose();
      master.dispose();
    };
  }, []);

  useFrame(() => {
    const ch    = chain.current;
    if (!ch) return;

    const phase = useGame.getState().phase;

    if (phase === "running") {
      if (!started.current && !starting.current) {
        starting.current = true;
        Tone.start()
          .then(() => {
            if (!chain.current) return;
            chain.current.windNoise.start();
            chain.current.rumbleNoise.start();
            // Slow fade-in over 3 s so ambient doesn't pop in abruptly.
            chain.current.master.gain.rampTo(1, 3);
            started.current  = true;
            starting.current = false;
          })
          .catch(() => { starting.current = false; });
      }
    } else if (started.current) {
      // Fade to silence when run ends.
      ch.master.gain.rampTo(0, 1.5);
    }
  });

  return null;
}
