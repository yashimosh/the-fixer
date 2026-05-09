// HUD — minimal corner readouts.
//
// Top-left: game title (always).
// Bottom-left: controls (always).
// Bottom-right: live speed in km/h, updated ~12 Hz from the Zustand store.
//   Subscribes with useGame selector so only this component re-renders on
//   speed changes; the rest of the tree is not touched.

import { useGame } from "../store";

export default function HUD() {
  const speedKmh = useGame(s => s.speedKmh);

  return (
    <>
      <div className="hud tl">
        <div className="k">the fixer</div>
        <div className="v">West Mosul · June 2017</div>
      </div>

      <div className="hud bl">
        <div className="k">WASD</div>
        <div className="v">drive</div>
        <div className="k" style={{ marginTop: "0.3em" }}>SPACE</div>
        <div className="v">brake</div>
      </div>

      <div className="hud br speed-readout">
        <span className="speed-num">{speedKmh}</span>
        <span className="speed-unit">km/h</span>
      </div>
    </>
  );
}
