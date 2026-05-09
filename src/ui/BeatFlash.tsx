// BeatFlash — transient mid-run text. Subscribes to the store's flashText
// + flashId; whenever flashId increments, fades in for ~4.5s then out.
//
// Each beat is a full sentence written for the run. Position-triggered by
// StoryWatcher in the scene tree; rendered as DOM here.

import { useEffect, useState } from "react";
import { useGame } from "../store";

export default function BeatFlash() {
  const flashText = useGame(s => s.flashText);
  const flashId   = useGame(s => s.flashId);
  const clearFlash = useGame(s => s.clearFlash);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!flashText) return;
    setShown(true);
    const t = window.setTimeout(() => {
      setShown(false);
      // Clear text after the fade-out finishes so it doesn't re-flash.
      window.setTimeout(clearFlash, 400);
    }, 4500);
    return () => window.clearTimeout(t);
  }, [flashId, flashText, clearFlash]);

  if (!flashText) return null;

  return (
    <div className={`beat-flash ${shown ? "show" : ""}`}>
      {flashText}
    </div>
  );
}
