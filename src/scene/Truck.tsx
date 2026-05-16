// Truck — Sor's vehicle. Land Cruiser silhouette built from primitives.
//
// Physics: Rapier DynamicRayCastVehicleController — real 4-wheel raycast
// vehicle with simulated suspension travel, friction slip, axle constraints,
// and ground contact. Replaces the previous single-cuboid fake-wheels
// implementation. This is the Bruno Simon / Border Run reference: the truck
// bounces over terrain bumps because each wheel raycasts independently and
// the suspension spring compresses/extends accordingly.
//
// Architecture:
//   - RigidBody hosts the chassis collider (covers cabin + hood + bed).
//   - useRapier() exposes the world to create the vehicle controller.
//   - The controller is created in a useEffect after the rigid body is mounted.
//   - Each frame: read input → set engine/brake/steering on appropriate wheels
//     → call updateVehicle(dt) → read wheel state → sync visual wheels.
//   - Visual wheels live as Groups INSIDE the RigidBody, so their positions
//     are in chassis-local space (matches the controller's coordinate system).
//
// Local axes (Rapier vehicle controller config):
//   indexUpAxis = 1       (Y is up)
//   indexForwardAxis = 2  (Z is forward in chassis local space)
// After the spawn-rotation π around Y: world +Z = forward driving direction.

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
// Drawn from Border Run constants (cannon-es RaycastVehicle) and scaled for
// Rapier's slightly different impulse units. The goal: bouncy, responsive,
// fun to drive. Bruno Simon territory.
const MAX_STEER_ANGLE   = 0.55;   // radians — wider lock than fake-wheel version
const ENGINE_FORCE_PEAK = 1400;   // applied to rear wheels under throttle
const BRAKE_FORCE       = 80;     // per-wheel brake impulse
const MAX_FORWARD_SPEED = 14;     // m/s ≈ 50 km/h — cap to prevent runaway

const WHEELBASE         = 2.7;    // distance front-to-rear axle
const TRACK_WIDTH       = 1.55;   // distance left-to-right wheel centres
const WHEEL_R           = 0.42;
const WHEEL_W           = 0.32;

// Suspension tuning — per wheel. Soft enough to absorb terrain noise without
// bottoming out, stiff enough that the chassis doesn't wallow on turns.
const SUSPENSION_REST   = 0.42;
const SUSPENSION_STIFF  = 28;
const SUSPENSION_COMP   = 1.6;    // damping during compression
const SUSPENSION_RELAX  = 2.4;    // damping during rebound (higher = less bouncy)
const SUSPENSION_TRAVEL = 0.35;
const MAX_SUSP_FORCE    = 60000;
const FRICTION_SLIP     = 2.5;    // traction — higher = more grip
const SIDE_FRICTION     = 0.85;

// ── Materials ──────────────────────────────────────────────────────────────
const COL_CHASSIS  = "#7d6845";   // warmer dust brown — bumped saturation for bloom
const COL_CABIN    = "#4f4a38";
const COL_TIRE     = "#1a1814";
const COL_RIM      = "#3a3a3a";
const COL_GLASS    = "#0d1418";
const COL_HEAD     = "#fff5d6";
const COL_TAIL     = "#a02828";
const COL_BUMPER   = "#36302a";

// Wheel index conventions used throughout this file:
//   0 = front-left, 1 = front-right, 2 = rear-left, 3 = rear-right
const FL = 0, FR = 1, RL = 2, RR = 3;

export default function Truck() {
  const { world } = useRapier();
  const body      = useRef<RapierRigidBody>(null);
  const keys      = useKeys();
  const frameNum  = useRef(0);

  const vehicle = useRef<DynamicRayCastVehicleController | null>(null);

  // Visual wheel refs — each is a Group whose position is set in chassis-
  // local space (Y = connection.y - suspensionLength), Y-rotation = steer,
  // X-rotation = spin angle.
  const wheelGroups = useRef<(Group | null)[]>([null, null, null, null]);

  // Smoothed steering target so input doesn't snap.
  const steerSmoothed = useRef(0);

  // ── Mount: register truckRef + create vehicle controller ────────────────
  useEffect(() => {
    if (!body.current) return;
    truckRef.current = body.current;

    const controller = world.createVehicleController(body.current);
    vehicle.current = controller;

    controller.indexUpAxis = 1;           // Y is up
    controller.setIndexForwardAxis = 2;   // Z is forward (chassis local)

    // Wheel attachment points in CHASSIS-LOCAL space.
    // Y = -0.35 puts the wheel hubs just below the chassis bottom.
    // The suspension then raycasts down from these anchor points.
    const positions: [number, number, number][] = [
      [-TRACK_WIDTH / 2, -0.35, -WHEELBASE / 2],  // FL
      [ TRACK_WIDTH / 2, -0.35, -WHEELBASE / 2],  // FR
      [-TRACK_WIDTH / 2, -0.35,  WHEELBASE / 2],  // RL
      [ TRACK_WIDTH / 2, -0.35,  WHEELBASE / 2],  // RR
    ];

    const susDir  = { x: 0, y: -1, z: 0 };   // suspension extends downward
    const axleDir = { x: -1, y: 0, z: 0 };   // wheels rotate around X axis

    for (const [x, y, z] of positions) {
      controller.addWheel(
        { x, y, z },
        susDir,
        axleDir,
        SUSPENSION_REST,
        WHEEL_R,
      );
    }

    // Configure each wheel identically.
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
        try { world.removeVehicleController(vehicle.current); } catch { /* world disposed */ }
        vehicle.current = null;
      }
      truckRef.current = null;
    };
  }, [world]);

  // ── Per-frame: input → controller → visual sync ─────────────────────────
  useFrame((_, dt) => {
    const controller = vehicle.current;
    const rb = body.current;
    if (!controller || !rb) return;

    const k = keys.current;
    const phase = useGame.getState().phase;
    const isRunning = phase === "running";

    // Forward speed reported by the controller (signed: + forward, - reverse).
    const speed = controller.currentVehicleSpeed();
    const speedAbs = Math.abs(speed);

    // ── Engine (rear-wheel drive) ─────────────────────────────────────────
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

    // ── Brake (all wheels) ────────────────────────────────────────────────
    const brake = (isRunning && k.brake) ? BRAKE_FORCE : 0;
    for (let i = 0; i < 4; i++) controller.setWheelBrake(i, brake);

    // ── Steering (front wheels) ───────────────────────────────────────────
    // Smooth toward target so a key-tap doesn't snap the wheels fully.
    // At speed, reduce max angle so high-speed turns require commitment.
    const speedFactor = Math.max(0.45, 1 - speedAbs / (MAX_FORWARD_SPEED * 1.2));
    const steerTarget = isRunning
      ? (k.left ? MAX_STEER_ANGLE : k.right ? -MAX_STEER_ANGLE : 0) * speedFactor
      : 0;
    steerSmoothed.current += (steerTarget - steerSmoothed.current) * Math.min(1, dt * 8);
    controller.setWheelSteering(FL, steerSmoothed.current);
    controller.setWheelSteering(FR, steerSmoothed.current);

    // ── Integrate vehicle (does raycasts, applies suspension forces) ──────
    controller.updateVehicle(dt);

    // ── Sync visual wheels ────────────────────────────────────────────────
    // Position: connection point + suspension travel along suspension dir (-Y).
    // Rotation: steering on Y axis (front wheels), spin on X axis (all wheels).
    for (let i = 0; i < 4; i++) {
      const g = wheelGroups.current[i];
      if (!g) continue;

      const conn = controller.wheelChassisConnectionPointCs(i);
      const susLen = controller.wheelSuspensionLength(i);
      if (conn) {
        const y = conn.y - (susLen ?? SUSPENSION_REST);
        g.position.set(conn.x, y, conn.z);
      }

      const steer = controller.wheelSteering(i) ?? 0;
      const rot   = controller.wheelRotation(i) ?? 0;
      g.rotation.set(rot, steer, 0);
    }

    // ── HUD speed (km/h), throttled to ~12 Hz ────────────────────────────
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
      // Face north — local -Z is forward, rotate π around Y so the truck
      // drives along world +Z (the direction the route extends).
      rotation={[0, Math.PI, 0]}
      canSleep={false}
      ccd
    >
      {/* Chassis collider — sized to fit cabin + hood + bed, sits above the
          wheels so the suspension has room to compress. */}
      <CuboidCollider args={[0.85, 0.45, 1.95]} position={[0, 0.45, 0]} />

      {/* ── Chassis lower body — full length, sits between the wheels ─── */}
      <mesh castShadow position={[0, -0.05, 0]}>
        <boxGeometry args={[1.8, 0.7, 4.2]} />
        <meshStandardMaterial color={COL_CHASSIS} roughness={0.85} metalness={0.05} flatShading />
      </mesh>

      {/* ── Hood (front lower box) ─────────────────────────────────────── */}
      <mesh castShadow position={[0, 0.45, -1.15]}>
        <boxGeometry args={[1.7, 0.45, 1.6]} />
        <meshStandardMaterial color={COL_CHASSIS} roughness={0.85} metalness={0.05} flatShading />
      </mesh>

      {/* ── Cabin ──────────────────────────────────────────────────────── */}
      <mesh castShadow position={[0, 0.65, 0.45]}>
        <boxGeometry args={[1.72, 0.95, 1.95]} />
        <meshStandardMaterial color={COL_CABIN} roughness={0.9} metalness={0.05} flatShading />
      </mesh>

      {/* ── Windshield ─────────────────────────────────────────────────── */}
      <mesh position={[0, 0.7, -0.55]}>
        <boxGeometry args={[1.55, 0.7, 0.05]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.8} />
      </mesh>

      {/* ── Side windows ───────────────────────────────────────────────── */}
      <mesh position={[-0.86, 0.75, 0.45]}>
        <boxGeometry args={[0.05, 0.5, 1.6]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[ 0.86, 0.75, 0.45]}>
        <boxGeometry args={[0.05, 0.5, 1.6]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.8} />
      </mesh>

      {/* ── Rear cargo bed cap ─────────────────────────────────────────── */}
      <mesh castShadow position={[0, 0.25, 1.65]}>
        <boxGeometry args={[1.7, 0.5, 0.85]} />
        <meshStandardMaterial color={COL_CHASSIS} roughness={0.95} metalness={0.05} flatShading />
      </mesh>

      {/* ── Roof rack ──────────────────────────────────────────────────── */}
      <mesh castShadow position={[0, 1.18, 0.45]}>
        <boxGeometry args={[1.55, 0.06, 1.7]} />
        <meshStandardMaterial color="#2a2620" roughness={1} metalness={0.1} flatShading />
      </mesh>

      {/* ── Front bumper ───────────────────────────────────────────────── */}
      <mesh castShadow position={[0, 0.05, -2.0]}>
        <boxGeometry args={[1.75, 0.18, 0.15]} />
        <meshStandardMaterial color={COL_BUMPER} roughness={0.7} metalness={0.3} />
      </mesh>

      {/* ── Headlights — emissive, bloom-friendly ──────────────────────── */}
      <mesh position={[-0.55, 0.45, -1.97]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
        <meshStandardMaterial color={COL_HEAD} emissive={COL_HEAD} emissiveIntensity={2.2} />
      </mesh>
      <mesh position={[ 0.55, 0.45, -1.97]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
        <meshStandardMaterial color={COL_HEAD} emissive={COL_HEAD} emissiveIntensity={2.2} />
      </mesh>

      {/* ── Tail lights ────────────────────────────────────────────────── */}
      <mesh position={[-0.78, 0.35, 2.07]}>
        <boxGeometry args={[0.18, 0.16, 0.04]} />
        <meshStandardMaterial color={COL_TAIL} emissive={COL_TAIL} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[ 0.78, 0.35, 2.07]}>
        <boxGeometry args={[0.18, 0.16, 0.04]} />
        <meshStandardMaterial color={COL_TAIL} emissive={COL_TAIL} emissiveIntensity={0.2} />
      </mesh>

      {/* ── Wheels — driven entirely by vehicle controller each frame ──── */}
      {/* These groups have no static position; useFrame writes position
          (chassis-local) and rotation (steer+spin) every tick. */}
      <group ref={(el) => { wheelGroups.current[FL] = el; }}><Wheel /></group>
      <group ref={(el) => { wheelGroups.current[FR] = el; }}><Wheel /></group>
      <group ref={(el) => { wheelGroups.current[RL] = el; }}><Wheel /></group>
      <group ref={(el) => { wheelGroups.current[RR] = el; }}><Wheel /></group>
    </RigidBody>
  );
}

// Single wheel mesh. Cylinder is created along Y axis by default; rotation
// [0, 0, π/2] on the mesh aligns it along X (the axle direction). The parent
// Group's rotation.x then spins the wheel, rotation.y steers it.
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
