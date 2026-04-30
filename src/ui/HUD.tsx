// HUD — minimal four-corner readout. Hello-world version: just the project
// name + controls hint. Real HUD (speed, cargo, heading, boost) lands when
// the canonical 2017 Mosul incident gets implemented.

export default function HUD() {
  return (
    <>
      <div className="hud tl">
        <div className="k">the fixer</div>
        <div className="v">pre-production</div>
      </div>
      <div className="hud bl">
        <div className="k">controls</div>
        <div className="v">WASD · drive</div>
        <div className="v">SPACE · brake</div>
      </div>
    </>
  );
}
