// Truck — Sor's vehicle. Hello-world version: a box-shaped rigid body driven
// by direct force/torque application. Not a real vehicle controller yet —
// Rapier's DynamicRayCastVehicleController comes in the next iteration.
//
// Geometry is a placeholder cuboid (Land Cruiser silhouette TBD). The colour
// is dust-on-brown to match Sor's wardrobe register.

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useKeys } from "../input/useKeys";
import { truckRef } from "./truckRef";

const ENGINE_FORCE      = 12;   // forward/back impulse magnitude
const STEER_TORQUE      = 4;    // yaw torque magnitude
const LINEAR_DAMPING    = 0.6;  // drag — keeps box from sliding forever
const ANGULAR_DAMPING   = 2.0;  // rotational drag — keeps box from spinning forever
const BRAKE_DAMPING_X10 = 6.0;  // multiplied damping when handbrake is held

export default function Truck() {
  const body = useRef<RapierRigidBody>(null);
  const keys = useKeys();

  // Publish the rigid-body ref to the shared module so the chase camera
  // (and future systems — particles, audio, story beats) can read transform.
  useEffect(() => {
    truckRef.current = body.current;
    return () => { truckRef.current = null; };
  }, []);

  useFrame(() => {
    const rb = body.current;
    if (!rb) return;
    const k = keys.current;

    // Apply damping each frame (Rapier exposes setLinearDamping per body).
    rb.setLinearDamping(k.brake ? BRAKE_DAMPING_X10 : LINEAR_DAMPING);
    rb.setAngularDamping(ANGULAR_DAMPING);

    // Forward/back: compute body's forward vector from its rotation, push
    // along it. Rapier rotation is a Quaternion; multiply local forward (-Z)
    // through it to get world-space forward.
    if (k.fwd || k.back) {
      const rot = rb.rotation();
      // Quaternion (x, y, z, w) × local-forward (0, 0, -1) → world forward.
      // q * v = (q * v_quat * q^-1).vector  — for v = (0,0,-1) this simplifies:
      const fx = -2 * (rot.x * rot.z + rot.w * rot.y);
      const fz = -1 + 2 * (rot.x * rot.x + rot.y * rot.y);
      const sign = k.fwd ? 1 : -0.6; // reverse is slower than forward
      rb.applyImpulse({ x: fx * ENGINE_FORCE * sign, y: 0, z: fz * ENGINE_FORCE * sign }, true);
    }

    // Left/right: yaw torque on world Y axis. Speed-scaled would be more
    // realistic; for hello-world a constant impulse is enough.
    if (k.left)  rb.applyTorqueImpulse({ x: 0, y:  STEER_TORQUE, z: 0 }, true);
    if (k.right) rb.applyTorqueImpulse({ x: 0, y: -STEER_TORQUE, z: 0 }, true);
  });

  return (
    <RigidBody
      ref={body}
      colliders="cuboid"
      mass={1200}
      position={[0, 1, 0]}
      enabledRotations={[false, true, false]}  // lock pitch and roll for the box-stage
    >
      <mesh castShadow>
        {/* ~Land Cruiser proportions — 4.4m long, 1.8m wide, 1.9m tall — for now. */}
        <boxGeometry args={[1.8, 1.4, 4.4]} />
        <meshStandardMaterial color="#6b5d48" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Headlight cubes — quick visual orientation cue while we have no real model. */}
      <mesh position={[-0.65, 0.4, -2.25]}>
        <boxGeometry args={[0.25, 0.18, 0.05]} />
        <meshStandardMaterial color="#fff5d6" emissive="#fff5d6" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0.65, 0.4, -2.25]}>
        <boxGeometry args={[0.25, 0.18, 0.05]} />
        <meshStandardMaterial color="#fff5d6" emissive="#fff5d6" emissiveIntensity={1.4} />
      </mesh>
    </RigidBody>
  );
}
