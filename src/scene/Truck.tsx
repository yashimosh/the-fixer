// Truck — Sor's vehicle. Real Rapier raycast vehicle, no fakery.
//
// COORDINATE CONVENTION (this matters — the previous version had a bug here):
//   Chassis local +Z = FORWARD (where headlights point, where wheels drive)
//   Chassis local -Z = REAR    (tail lights, cargo bed cap)
//   Chassis local +X = RIGHT side
//   indexForwardAxis = 2 (chassis +Z is forward direction for the controller)
//   indexUpAxis      = 1 (chassis +Y is up)
//
// Spawn rotation = 0. The truck is built so its natural orientation
// (chassis +Z = forward) matches world +Z = north = route direction. No need
// to rotate the rigid body; engine force in +Z drives it down the route.
//
// Wheel indices:
//   0 = front-left  (steerable, free-rolling)
//   1 = front-right (steerable, free-rolling)
//   2 = rear-left   (driven by engine, brake)
//   3 = rear-right  (driven by engine, brake)
//
// Visual wheels are Groups inside the RigidBody. Each frame:
//   group.position = (chassis_connection.x, connection.y - susLength, connection.z)
//   group.rotation = (spin_x, steer_y, 0)
// The mesh inside each group is a cylinder rotated to align along X (axle).
//
// Why this is different from the previous attempt:
//   v1 rotated the RigidBody π around Y so the truck visual faced world +Z
//   but engine force then drove the truck the wrong way (chassis +Z → world -Z).
//   This version puts chassis +Z = forward natively. No rotation gymnastics.

import { useRef, useEffect } from "react";
import type { Group } from "three";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  CuboidCollider,
  useRapier,
  type RapierRigidBody,
} from "@react-three/rapier";
import type { DynamicRayCastVehicleController } from "@dimforge/rapier3d-compat";
import { useKeys } from "../input/useKeys";
import { truckRef } from "./truckRef";
import { useGame } from "../store";
import { SPAWN_X, SPAWN_Y, SPAWN_Z } from "./terrainFn";

// ── Vehicle tuning ─────────────────────────────────────────────────────────
const MAX_STEER_ANGLE   = 0.55;
const ENGINE_FORCE_PEAK = 1400;
const BRAKE_FORCE       = 80;
const MAX_FORWARD_SPEED = 14;     // m/s ≈ 50 km/h

const WHEELBASE         = 2.7;
const TRACK_WIDTH       = 1.55;
const WHEEL_R           = 0.42;
const WHEEL_W           = 0.32;

// Suspension — soft enough to absorb terrain bumps, stiff enough not to wallow.
const SUSPENSION_REST   = 0.42;
const SUSPENSION_STIFF  = 28;
const SUSPENSION_COMP   = 1.6;
const SUSPENSION_RELAX  = 2.4;
const SUSPENSION_TRAVEL = 0.35;
const MAX_SUSP_FORCE    = 60000;
const FRICTION_SLIP     = 2.5;
const SIDE_FRICTION     = 0.85;

// ── Materials ──────────────────────────────────────────────────────────────
const COL_CHASSIS  = "#7d6845";
const COL_CABIN    = "#4f4a38";
const COL_TIRE     = "#1a1814";
const COL_RIM      = "#3a3a3a";
const COL_GLASS    = "#0d1418";
const COL_HEAD     = "#fff5d6";
const COL_TAIL     = "#a02828";
const COL_BUMPER   = "#36302a";

// Wheel index constants — clearer than magic numbers in the engine code.
const FL = 0, FR = 1, RL = 2, RR = 3;

export default function Truck() {
  const { world } = useRapier();
  const body      = useRef<RapierRigidBody>(null);
  const keys      = useKeys();
  const frameNum  = useRef(0);

  const vehicle = useRef<DynamicRayCastVehicleController | null>(null);

  // Visual wheel refs.
  const wheelGroups = useRef<(Group | null)[]>([null, null, null, null]);
  const steerSmoothed = useRef(0);

  useEffect(() => {
    if (!body.current) return;
    truckRef.current = body.current;

    const controller = world.createVehicleController(body.current);
    vehicle.current = controller;

    controller.indexUpAxis = 1;
    controller.setIndexForwardAxis = 2;  // chassis +Z is forward

    // Wheel attachment in CHASSIS-LOCAL space. Front wheels at +Z.
    // Y = -0.35 puts the suspension anchor just below the chassis bottom.
    const positions: [number, number, number][] = [
      [-TRACK_WIDTH / 2, -0.35,  WHEELBASE / 2],  // FL — front-left
      [ TRACK_WIDTH / 2, -0.35,  WHEELBASE / 2],  // FR — front-right
      [-TRACK_WIDTH / 2, -0.35, -WHEELBASE / 2],  // RL — rear-left
      [ TRACK_WIDTH / 2, -0.35, -WHEELBASE / 2],  // RR — rear-right
    ];

    const susDir  = { x: 0, y: -1, z: 0 };
    const axleDir = { x: -1, y: 0, z: 0 };

    for (const [x, y, z] of positions) {
      controller.addWheel({ x, y, z }, susDir, axleDir, SUSPENSION_REST, WHEEL_R);
    }

    for (let i = 0; i < 4; i++) {
      controller.setWheelSuspensionStiffness(i, SUSPENSION_STIFF);
      controller.setWheelSuspensionCompression(i, SUSPENSION_COMP);
      controller.setWheelSuspensionRelaxation(i, SUSPENSION_RELAX);
      controller.setWheelMaxSuspensionTravel(i, SUSPENSION_TRAVEL);
      controller.setWheelMaxSuspensionForce(i, MAX_SUSP_FORCE);
      controller.setWheelFrictionSlip(i, FRICTION_SLIP);
      controller.setWheelSideFrictionStiffness(i, SIDE_FRICTION);
    }

    return () => {
      if (vehicle.current) {
        try { world.removeVehicleController(vehicle.current); } catch { /* ignore */ }
        vehicle.current = null;
      }
      truckRef.current = null;
    };
  }, [world]);

  useFrame((_, dt) => {
    const controller = vehicle.current;
    const rb = body.current;
    if (!controller || !rb) return;

    const k = keys.current;
    const phase = useGame.getState().phase;
    const isRunning = phase === "running";

    // currentVehicleSpeed: signed along forward axis. Positive = moving forward.
    const speed = controller.currentVehicleSpeed();
    const speedAbs = Math.abs(speed);

    // ── Engine (rear-wheel drive — wheels at chassis -Z) ─────────────────
    // Positive engine force drives chassis in +Z (forward). k.fwd → positive.
    let engineForce = 0;
    if (isRunning) {
      if (k.fwd && speed < MAX_FORWARD_SPEED) {
        engineForce = ENGINE_FORCE_PEAK;
      } else if (k.back && speed > -MAX_FORWARD_SPEED * 0.5) {
        engineForce = -ENGINE_FORCE_PEAK * 0.6;
      }
    }
    controller.setWheelEngineForce(RL, engineForce);
    controller.setWheelEngineForce(RR, engineForce);

    // ── Brake (all wheels) ───────────────────────────────────────────────
    const brake = (isRunning && k.brake) ? BRAKE_FORCE : 0;
    for (let i = 0; i < 4; i++) controller.setWheelBrake(i, brake);

    // ── Steering (front wheels — wheels at chassis +Z) ───────────────────
    // Positive steering = turn left (counter-clockwise viewed from above)
    // when moving forward (+Z). k.left → positive.
    const speedFactor = Math.max(0.45, 1 - speedAbs / (MAX_FORWARD_SPEED * 1.2));
    const steerTarget = isRunning
      ? (k.left ? MAX_STEER_ANGLE : k.right ? -MAX_STEER_ANGLE : 0) * speedFactor
      : 0;
    steerSmoothed.current += (steerTarget - steerSmoothed.current) * Math.min(1, dt * 8);
    controller.setWheelSteering(FL, steerSmoothed.current);
    controller.setWheelSteering(FR, steerSmoothed.current);

    // ── Integrate vehicle ────────────────────────────────────────────────
    controller.updateVehicle(dt);

    // ── Sync visual wheels ───────────────────────────────────────────────
    for (let i = 0; i < 4; i++) {
      const g = wheelGroups.current[i];
      if (!g) continue;
      const conn = controller.wheelChassisConnectionPointCs(i);
      const susLen = controller.wheelSuspensionLength(i);
      if (conn) {
        g.position.set(conn.x, conn.y - (susLen ?? SUSPENSION_REST), conn.z);
      }
      const steer = controller.wheelSteering(i) ?? 0;
      const rot   = controller.wheelRotation(i) ?? 0;
      g.rotation.set(rot, steer, 0);
    }

    // HUD speed (km/h)
    frameNum.current++;
    if (frameNum.current % 5 === 0) {
      useGame.getState().setSpeed(Math.round(speedAbs * 3.6));
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      mass={1500}
      position={[SPAWN_X, SPAWN_Y, SPAWN_Z]}
      // NO spawn rotation. Chassis +Z = forward, naturally aligns with world +Z.
      canSleep={false}
      ccd
    >
      {/* Chassis collider — sits above wheels so suspension has room. */}
      <CuboidCollider args={[0.85, 0.45, 1.95]} position={[0, 0.45, 0]} />

      {/* ── Chassis lower body ─────────────────────────────────────────── */}
      <mesh castShadow position={[0, -0.05, 0]}>
        <boxGeometry args={[1.8, 0.7, 4.2]} />
        <meshStandardMaterial color={COL_CHASSIS} roughness={0.85} metalness={0.05} flatShading />
      </mesh>

      {/* ── Hood (FRONT, +Z) ───────────────────────────────────────────── */}
      <mesh castShadow position={[0, 0.45, 1.15]}>
        <boxGeometry args={[1.7, 0.45, 1.6]} />
        <meshStandardMaterial color={COL_CHASSIS} roughness={0.85} metalness={0.05} flatShading />
      </mesh>

      {/* ── Cabin (rear of hood, -Z) ───────────────────────────────────── */}
      <mesh castShadow position={[0, 0.65, -0.45]}>
        <boxGeometry args={[1.72, 0.95, 1.95]} />
        <meshStandardMaterial color={COL_CABIN} roughness={0.9} metalness={0.05} flatShading />
      </mesh>

      {/* ── Windshield (front of cabin, +0.55 from cabin = chassis +0.55-(-0.45/2)...
            Cabin centre is -0.45, cabin depth 1.95 → cabin front face at -0.45+0.975=+0.525.
            Windshield sits right at that face, slightly forward. */}
      <mesh position={[0, 0.7, 0.55]}>
        <boxGeometry args={[1.55, 0.7, 0.05]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.8} />
      </mesh>

      {/* ── Side windows ───────────────────────────────────────────────── */}
      <mesh position={[-0.86, 0.75, -0.45]}>
        <boxGeometry args={[0.05, 0.5, 1.6]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[ 0.86, 0.75, -0.45]}>
        <boxGeometry args={[0.05, 0.5, 1.6]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.8} />
      </mesh>

      {/* ── Rear cargo bed cap (-Z, behind cabin) ──────────────────────── */}
      <mesh castShadow position={[0, 0.25, -1.65]}>
        <boxGeometry args={[1.7, 0.5, 0.85]} />
        <meshStandardMaterial color={COL_CHASSIS} roughness={0.95} metalness={0.05} flatShading />
      </mesh>

      {/* ── Roof rack (above cabin) ────────────────────────────────────── */}
      <mesh castShadow position={[0, 1.18, -0.45]}>
        <boxGeometry args={[1.55, 0.06, 1.7]} />
        <meshStandardMaterial color="#2a2620" roughness={1} metalness={0.1} flatShading />
      </mesh>

      {/* ── Front bumper (+Z front edge) ───────────────────────────────── */}
      <mesh castShadow position={[0, 0.05, 2.0]}>
        <boxGeometry args={[1.75, 0.18, 0.15]} />
        <meshStandardMaterial color={COL_BUMPER} roughness={0.7} metalness={0.3} />
      </mesh>

      {/* ── Headlights (front, +Z) — emissive for bloom ────────────────── */}
      <mesh position={[-0.55, 0.45, 1.97]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
        <meshStandardMaterial color={COL_HEAD} emissive={COL_HEAD} emissiveIntensity={2.4} />
      </mesh>
      <mesh position={[ 0.55, 0.45, 1.97]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
        <meshStandardMaterial color={COL_HEAD} emissive={COL_HEAD} emissiveIntensity={2.4} />
      </mesh>

      {/* ── Tail lights (rear, -Z) ─────────────────────────────────────── */}
      <mesh position={[-0.78, 0.35, -2.07]}>
        <boxGeometry args={[0.18, 0.16, 0.04]} />
        <meshStandardMaterial color={COL_TAIL} emissive={COL_TAIL} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[ 0.78, 0.35, -2.07]}>
        <boxGeometry args={[0.18, 0.16, 0.04]} />
        <meshStandardMaterial color={COL_TAIL} emissive={COL_TAIL} emissiveIntensity={0.2} />
      </mesh>

      {/* ── Wheels — vehicle controller writes position+rotation each frame ── */}
      <group ref={(el) => { wheelGroups.current[FL] = el; }}><Wheel /></group>
      <group ref={(el) => { wheelGroups.current[FR] = el; }}><Wheel /></group>
      <group ref={(el) => { wheelGroups.current[RL] = el; }}><Wheel /></group>
      <group ref={(el) => { wheelGroups.current[RR] = el; }}><Wheel /></group>
    </RigidBody>
  );
}

function Wheel() {
  return (
    <>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, WHEEL_W, 18]} />
        <meshStandardMaterial color={COL_TIRE} roughness={0.95} metalness={0} flatShading />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[WHEEL_R * 0.55, WHEEL_R * 0.55, WHEEL_W + 0.02, 12]} />
        <meshStandardMaterial color={COL_RIM} roughness={0.6} metalness={0.4} flatShading />
      </mesh>
    </>
  );
}
