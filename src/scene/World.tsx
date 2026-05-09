// World — the 3D scene root. Lighting, sky, ground, the truck, the chase camera.
//
// At hello-world stage: flat ground plane + a box truck Sor can drive with WASD.
// Future: heightfield terrain (sampled from a function, not a baked grid),
// chunk streaming, scenery, NPC traffic, weather. See README.md roadmap.

import { Sky } from "@react-three/drei";
import Truck from "./Truck";
import Terrain from "./Terrain";
import ChaseCamera from "./ChaseCamera";

export default function World() {
  return (
    <>
      {/* Sky — Preetham atmospheric scattering. Sun low + slightly side-on. */}
      <Sky
        sunPosition={[40, 8, -60]}
        turbidity={4.5}
        rayleigh={1.6}
        mieCoefficient={0.006}
        mieDirectionalG={0.86}
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
      <Truck />

      {/* Chase camera — follows the truck's chassis transform every frame. */}
      <ChaseCamera />
    </>
  );
}
