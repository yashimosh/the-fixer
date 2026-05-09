// HUD — minimal corner readouts.
//
// Top-left: game title (always).
// Top-right: cargo status — dim dots, one per cargo item. Lost items go dark.
//            The player notices this only after a run or two. No tooltip.
// Bottom-left: controls (always, during run).
// Bottom-right: live speed in km/h, updated ~12 Hz from the Zustand store.

import { useGame } from "../store";

export default function HUD() {
  const speedKmh    = useGame(s => s.speedKmh);
  const cargoTotal  = useGame(s => s.cargoTotal);
  const cargoSec    = useGame(s => s.cargoSecured);
  const phase       = useGame(s => s.phase);

  // Cargo dots — visible during run and on ending card, hidden on intro.
  const showCargo = phase !== "intro";

  return (
    <>
      <div className="hud tl">
        <div className="k">the fixer</div>
        <div className="v">West Mosul · June 2017</div>
      </div>

      {showCargo && (
        <div className="hud tr cargo-dots">
          {Array.from({ length: cargoTotal }).map((_, i) => (
            <span
              key={i}
              className={i < cargoSec ? "dot dot--on" : "dot dot--off"}
            />
          ))}
        </div>
      )}

      {phase === "running" && (
        <div className="hud bl">
          <div className="k">WASD</div>
          <div className="v">drive</div>
          <div className="k" style={{ marginTop: "0.3em" }}>SPACE</div>
          <div className="v">brake</div>
        </div>
      )}

      <div className="hud br speed-readout">
        <span className="speed-num">{speedKmh}</span>
        <span className="speed-unit">km/h</span>
      </div>
    </>
  );
}
