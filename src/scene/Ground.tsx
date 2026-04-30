// Ground — flat receiver plane. Static rigid body for physics.
// Replaced later by streamed heightfield terrain. See LESSONS.md for why
// the heightfield should be sampled from a pure function, not a baked grid.

import { RigidBody, CuboidCollider } from "@react-three/rapier";

export default function Ground() {
  return (
    <RigidBody type="fixed" colliders={false} position={[0, -0.1, 0]}>
      <CuboidCollider args={[200, 0.1, 200]} />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#7a6f55" roughness={1} />
      </mesh>
    </RigidBody>
  );
}
