// World — the 3D scene root. Lighting, sky, terrain chunks, set pieces,
// the truck, the chase camera.
//
// Terrain streams in 100m chunks around the truck (Terrain.tsx); each chunk
// carries its own merged scenery. The checkpoint and the Hilux are the two
// scripted world anchors for cargo-risk beats — the world telling the story
// the text only points at.

import { Sky } from "@react-three/drei";
import Truck from "./Truck";
import Terrain from "./Terrain";
import Checkpoint from "./Checkpoint";
import Hilux from "./Hilux";
import ChaseCamera from "./ChaseCamera";
import SunLight from "./SunLight";
import EngineAudio from "./EngineAudio";
import AmbientAudio from "./AmbientAudio";
import Pedestrians from "./Pedestrians";
import PostFX from "./PostFX";

export default function World() {
  return (
    <>
      {/* Fallback scene background — dawn navy. Visible if Sky doesn't render
          (e.g. tone mapping misconfigured) so it's never a browser-grey void. */}
      <color attach="background" args={["#0f1e2e"]} />

      {/* Sky — Preetham atmospheric scattering.
          turbidity 6 → hazy dawn atmosphere, blends sun disk into horizon glow.
          Sun low + side-on gives a clear warm/cold sky gradient. */}
      {/* Sun rises from the east (+X). Truck drives north (+Z).
          Side lighting means the terrain and truck read clearly — no backlit
          silhouette problem from having the sun directly behind the camera. */}
      <Sky
        sunPosition={[100, 8, 30]}
        turbidity={6}
        rayleigh={3}
        mieCoefficient={0.005}
        mieDirectionalG={0.85}
      />

      {/* Lighting — dawn. Hemisphere for sky/ground bounce; the directional
          sun lives in SunLight (its shadow frustum follows the truck across
          the 800m route — a fixed box would lose shadows around z≈200). */}
      <hemisphereLight args={["#b0a898", "#3a3326", 0.65]} />
      <SunLight />

      {/* Fill light — cool west-side sky bounce. Illuminates surfaces the sun
          can't reach (south-facing walls, truck undercarriage). Low intensity
          so it reads as ambient sky reflection, not a second sun. No shadows. */}
      <directionalLight
        position={[-80, 25, -60]}
        intensity={0.55}
        color="#99aacc"
      />

      {/* Atmospheric depth — warm dust haze. Color matches the dawn horizon
          so the distance fades to a convincing Mosul haze rather than cold
          grey. Far plane 380m also hides terrain-chunk pop-in (chunks spawn
          at 360m ahead). */}
      <fog attach="fog" args={["#c8b89a", 80, 380]} />

      {/* Chunk-streamed heightfield terrain + merged scenery (static),
          and the truck (dynamic). All share heightAt() for agreement. */}
      <Terrain />
      <Pedestrians />
      <Truck />

      {/* Set pieces — world anchors for the cargo-risk beats. */}
      <Checkpoint />
      <Hilux />

      {/* Chase camera — follows the truck's chassis transform every frame. */}
      <ChaseCamera />

      {/* Procedural engine audio — pitches with truck velocity. */}
      <EngineAudio />

      {/* Ambient environmental audio — wind texture + distant low rumble.
          Room tone only: should be felt, not noticed. */}
      <AmbientAudio />

      {/* Post-processing — bloom on emissive headlights + vignette frame. */}
      <PostFX />
    </>
  );
}
