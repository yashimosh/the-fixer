// World — the 3D scene root. Lighting, sky, ground, the truck, the chase camera.
//
// At hello-world stage: flat ground plane + a box truck Sor can drive with WASD.
// Future: heightfield terrain (sampled from a function, not a baked grid),
// chunk streaming, scenery, NPC traffic, weather. See README.md roadmap.

import { Sky } from "@react-three/drei";
import Truck from "./Truck";
import Terrain from "./Terrain";
import ChaseCamera from "./ChaseCamera";
import EngineAudio from "./EngineAudio";
import AmbientAudio from "./AmbientAudio";
import Scenery from "./Scenery";
import PostFX from "./PostFX";

export default function World() {
  return (
    <>
      {/* Fallback scene background — dawn navy. Visible if Sky doesn't render
          (e.g. tone mapping misconfigured) so it's never a browser-grey void. */}
      <color attach="background" args={["#0f1e2e"]} />

      {/* Sky — Preetham atmospheric scattering.
          rayleigh 2.8 → deep blue Rayleigh band above horizon.
          turbidity 7 → hazy dawn atmosphere, blends sun disk into horizon glow.
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

      {/* Lighting — dawn. Hemisphere for sky/ground bounce. Directional matches
          sun position: east-northeast low angle. Warm orange-gold rakes across
          terrain at a glancing angle, giving the sand texture without bloom. */}
      <hemisphereLight args={["#b0a898", "#3a3326", 0.65]} />
      <directionalLight
        position={[100, 40, 20]}
        intensity={2.5}
        color="#ffb86a"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
        shadow-camera-near={1}
        shadow-camera-far={600}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
      />

      {/* Fill light — cool west-side sky bounce. Illuminates surfaces the sun
          can't reach (south-facing walls, truck undercarriage). Low intensity
          so it reads as ambient sky reflection, not a second sun. No shadows. */}
      <directionalLight
        position={[-80, 25, -60]}
        intensity={0.55}
        color="#99aacc"
      />

      {/* Atmospheric depth — warm dust haze. Color matches the dawn horizon
          so the distance fades to a convincing Mosul haze rather than cold grey.
          Near reduced to 80m: wall slabs and husks pop in with more drama. */}
      <fog attach="fog" args={["#c8b89a", 80, 380]} />

      {/* Heightfield terrain (static) + the truck (dynamic). Both share the
          same heightAt() function for visual / collision agreement. */}
      <Terrain />
      <Scenery />
      <Truck />

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
