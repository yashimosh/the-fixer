// truckRef — shared mutable ref to the truck's RigidBody.
//
// R3F idiomatic pattern: components that need to read another component's
// transform every frame import a shared ref module. Truck.tsx assigns the
// ref on mount; ChaseCamera.tsx reads it in useFrame.
//
// Avoids prop-drilling, avoids context (which would re-render on every change),
// and stays out of Zustand (which is for game state, not scene-graph plumbing).

import type { RapierRigidBody } from "@react-three/rapier";

export const truckRef: { current: RapierRigidBody | null } = { current: null };
