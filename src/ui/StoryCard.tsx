// StoryCard — full-screen narrative overlay for intro and ending.
//
// Used in two phases:
//   - phase === "intro"  → shows the incident's intro text + "drive" button
//   - phase === "ended"  → shows the ending variant + "again" button
//
// While the card is up, driving input is gated upstream (the engine idles,
// the world keeps rendering underneath). That's handled by the scene's
// useKeys hook — when phase !== "running", input is ignored at the consumer
// (Truck) level.

import * as Tone from "tone";
import { useGame } from "../store";

export default function StoryCard() {
  const phase    = useGame(s => s.phase);
  const incident = useGame(s => s.incident);
  const ending   = useGame(s => s.endingState);
  const startRun = useGame(s => s.startRun);

  if (phase === "running") return null;

  let lines: string[] = [];
  let action: string  = "drive";
  let onClick: () => void = startRun;

  if (phase === "intro") {
    lines  = incident.intro;
    action = "drive";
    // Tone.start() MUST fire inside the user gesture (button click) so the
    // AudioContext is allowed to resume. EngineAudio picks it up next frame.
    onClick = () => { void Tone.start(); startRun(); };
  } else if (phase === "ended") {
    const variant = ending ?? "clean";
    lines = incident.endings[variant];
    action = "again";
    onClick = () => location.reload();
  }

  // First line is the dateline (smaller, uppercase, dimmer).
  const [dateline, ...body] = lines;

  return (
    <div className="story-card show" role="dialog" aria-modal="true">
      <div className="story-card-inner">
        <div className="story-card-text">
          <p className="dateline">{dateline}</p>
          {body.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <button
          className="story-card-action"
          type="button"
          onClick={onClick}
        >
          {action}
        </button>
      </div>
    </div>
  );
}
