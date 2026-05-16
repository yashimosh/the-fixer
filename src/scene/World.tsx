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
      <Sky
        sunPosition={[80, 12, -100]}
        turbidity={7}
        rayleigh={2.8}
        mieCoefficient={0.004}
        mieDirectionalG={0.82}
      />

      {/* Lighting — dawn. Cool ambient, warm directional grazing the truck side-on. */}
      <hemisphereLight args={["#a3a89e", "#3a3326", 0.7]} />
      <directionalLight
        position={[60, 50, -40]}
        intensity={2.2}
        color="#ffd1a0"
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

      {/* Atmospheric depth — pushed out so the ground reads near the truck. */}
      <fog attach="fog" args={["#b4b8b6", 140, 480]} />

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
    </>
  );
}
