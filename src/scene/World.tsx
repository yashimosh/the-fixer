// World — the 3D scene root. Lighting, sky, ground, the truck, the chase camera.
//
// At hello-world stage: flat ground plane + a box truck Sor can drive with WASD.
// Future: heightfield terrain (sampled from a function, not a baked grid),
// chunk streaming, scenery, NPC traffic, weather. See README.md roadmap.

import { Sky } from "@react-three/drei";
import Truck from "./Truck";
import Ground from "./Ground";
import ChaseCamera from "./ChaseCamera";

export default function World() {
  return (
    <>
      {/* Sky — Preetham atmospheric scattering. Low sun = dawn register. */}
      <Sky
        sunPosition={[100, 12, 80]}
        turbidity={4.5}
        rayleigh={1.6}
        mieCoefficient={0.006}
        mieDirectionalG={0.86}
      />

      {/* Lighting — dawn. Cool ambient, warm directional. */}
      <hemisphereLight args={["#88928a", "#2a2a20", 0.32]} />
      <directionalLight
        position={[100, 70, 80]}
        intensity={1.6}
        color="#ffd9a8"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />

      {/* Atmospheric depth — colour anchored to dawn grey-blue, not generic black. */}
      <fog attach="fog" args={["#a8b0b8", 80, 360]} />

      {/* The ground (static rigid body) and the truck (dynamic rigid body). */}
      <Ground />
      <Truck />

      {/* Chase camera — follows the truck's chassis transform every frame. */}
      <ChaseCamera />
    </>
  );
}
