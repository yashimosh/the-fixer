// Truck — Sor's vehicle. Real Rapier raycast vehicle, no fakery.
//
// COORDINATE CONVENTION (this matters — the previous version had a bug here):
//   Chassis local +Z = FORWARD (where headlights point, where wheels drive)
//   Chassis local -Z = REAR    (tail lights, cargo bed)
//   Chassis local +X = RIGHT side
//   indexForwardAxis = 2 (chassis +Z is forward direction for the controller)
//   indexUpAxis      = 1 (chassis +Y is up)
//
// Spawn rotation = 0. The truck is built so its natural orientation
// (chassis +Z = forward) matches world +Z = north = route direction.
//
// Wheel indices:
//   0 = front-left  (steerable, free-rolling)
//   1 = front-right (steerable, free-rolling)
//   2 = rear-left   (driven by engine, brake)
//   3 = rear-right  (driven by engine, brake)
//
// CHARACTER PRESENCE (CHARACTER-SOR.md — "felt more than seen"):
// The cabin is a glasshouse — sill, pillars, roof, tinted panes — so Sor
// reads as a dark seated silhouette at the wheel. LHD (Iraq drives on the
// right), so he sits on the left. A tasbih hangs at the windshield. Two
// cargo cases ride in the open bed; when a cargo-risk beat costs an item,
// a case slumps askew — the loss is visible on the vehicle itself, not
// just in the HUD dots. Jerry can on the rear, mismatched front-left rim,
// rolled tarp on the roof rack. Dusty, driven, no press markings.

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
import { SPAWN_X, SPAWN_Y, SPAWN_Z, heightAt, trackCenterX } from "./terrainFn";

// ── Vehicle tuning ─────────────────────────────────────────────────────────
// THE MASS IS INTENTIONAL — READ BEFORE "FIXING" (2026-06-12):
// The chassis rigid body weighs ~6 kg, not 1500. The RigidBody `mass` prop
// was silently ignored for the whole life of this controller (mass must be
// set on the collider), so every constant here was holistically tuned around
// a 6 kg body — and in THAT regime the controller's traction clamp
// (proportional to suspension load) governs the dynamics smoothly. That's
// the planted, toy-like, Bruno-Simon feel the playtests confirmed.
//
// Realistic mass was tried (collider mass 1500 + rescaled engine/brake) and
// produced strictly worse play: grip-flips onto the side in ordinary
// corrections, momentum-scrubbing steering plow, rhythmic traction collapse
// on facet bumps, and a spawn-settle explosion when a ballast collider was
// added to lower the CG. The arcade regime + the graded road (terrainFn) +
// the recovery net + the stability assist below is the configuration that
// actually drives well. Treat collider mass as a LOAD-BEARING constant.
const MAX_STEER_ANGLE   = 0.55;
const ENGINE_FORCE_PEAK = 1400;
// Brake sized to the ~6 kg body: the historical 80 N/wheel was a 53 m/s²
// stop that pitched the truck onto its roof at speed (caught on camera,
// 2026-06-12). 12 N/wheel ≈ 8 m/s² full braking — firm, no nose-flip.
// Rear bias for the same reason (front braking is what rotates the nose in).
const BRAKE_FORCE       = 12;
const BRAKE_FRONT_BIAS  = 0.5;    // front wheels get half the brake force
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

// ── Stability assist (arcade layer) ────────────────────────────────────────
// Two gentle, continuous corrections after each vehicle update:
//   - roll/pitch angular velocity is exponentially damped (kills building
//     oscillation BEFORE it becomes a flip or a porpoise),
//   - a spring torque pulls the chassis up-vector toward world-up.
// Yaw is left alone — steering must stay 1:1 with player input.
// K is sized to the ~6 kg arcade body (inertia ~2 kg·m²; see mass note).
const ASSIST_RP_DAMP    = 6;     // 1/s — roll+pitch rate damping
const ASSIST_UPRIGHT_K  = 40;    // N·m per radian of lean — upright spring

// ── Materials ──────────────────────────────────────────────────────────────
const COL_CHASSIS  = "#7d6845";
const COL_CABIN    = "#4f4a38";
const COL_TIRE     = "#1a1814";
const COL_RIM      = "#3a3a3a";
const COL_RIM_ODD  = "#6e5a48";   // the recently-replaced front-left wheel
const COL_GLASS    = "#0d1418";
const COL_HEAD     = "#fff5d6";
const COL_TAIL     = "#a02828";
const COL_BUMPER   = "#36302a";
const COL_SOR      = "#3a2e20";   // brown duck-canvas chore jacket, in shade
const COL_SOR_DARK = "#1c1612";   // beanie / hair
const COL_SEAT     = "#2a241e";
const COL_CASE     = "#23282c";   // hard cases in the bed
const COL_JERRY    = "#4a4f38";
const COL_TARP     = "#5a4838";
const COL_TASBIH   = "#6b3030";

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
  const stuckSeconds  = useRef(0);
  const rolledSeconds = useRef(0);
  const throttleRecency = useRef(0); // seconds since last throttle input (inverted window)

  // Cargo-loss visual — cases slump when items are lost. Subscribing via the
  // hook re-renders the component on loss; that's a rare, cheap event.
  const cargoLost = useGame(
    (s) => s.cargoTotal - s.cargoSecured,
  );

  useEffect(() => {
    if (!body.current) return;
    truckRef.current = body.current;

    const controller = world.createVehicleController(body.current);
    vehicle.current = controller;

    // Debug exposure — the effective mass Rapier actually simulates.
    // (The RigidBody `mass` prop is NOT applied when colliders are built
    // manually with their own props — measure, don't assume.)
    (window as unknown as Record<string, unknown>).__fixerTruckMass =
      body.current.mass();
    console.info("[fixer] truck rigid-body mass:", body.current.mass());

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
    // Force tapers over the last 3 m/s before MAX — a hard per-frame cutoff
    // overshoots badly on the light arcade body (ΔV per frame is large).
    let engineForce = 0;
    if (isRunning) {
      if (k.fwd && speed < MAX_FORWARD_SPEED) {
        const taper = Math.min(1, (MAX_FORWARD_SPEED - speed) / 3);
        engineForce = ENGINE_FORCE_PEAK * taper;
      } else if (k.back && speed > -MAX_FORWARD_SPEED * 0.5) {
        engineForce = -ENGINE_FORCE_PEAK * 0.6;
      }
    }
    controller.setWheelEngineForce(RL, engineForce);
    controller.setWheelEngineForce(RR, engineForce);

    // ── Brake (all wheels, rear-biased) ──────────────────────────────────
    const brake = (isRunning && k.brake) ? BRAKE_FORCE : 0;
    controller.setWheelBrake(FL, brake * BRAKE_FRONT_BIAS);
    controller.setWheelBrake(FR, brake * BRAKE_FRONT_BIAS);
    controller.setWheelBrake(RL, brake);
    controller.setWheelBrake(RR, brake);

    // ── Steering (front wheels — wheels at chassis +Z) ───────────────────
    const speedFactor = Math.max(0.45, 1 - speedAbs / (MAX_FORWARD_SPEED * 1.2));
    const steerTarget = isRunning
      ? (k.left ? MAX_STEER_ANGLE : k.right ? -MAX_STEER_ANGLE : 0) * speedFactor
      : 0;
    steerSmoothed.current += (steerTarget - steerSmoothed.current) * Math.min(1, dt * 8);
    controller.setWheelSteering(FL, steerSmoothed.current);
    controller.setWheelSteering(FR, steerSmoothed.current);

    // ── Integrate vehicle ────────────────────────────────────────────────
    // Clamped dt: the physics world steps at a fixed 1/60 (see App.tsx);
    // the controller must never integrate a rAF dt spike in one step.
    controller.updateVehicle(Math.min(dt, 1 / 60));

    // ── Stability assist ─────────────────────────────────────────────────
    // 1. Damp roll/pitch rates (leave yaw to the steering).
    const av = rb.angvel();
    const rpDamp = Math.exp(-ASSIST_RP_DAMP * dt);
    rb.setAngvel({ x: av.x * rpDamp, y: av.y, z: av.z * rpDamp }, true);

    // 2. Upright spring — torque along (chassisUp × worldUp), proportional
    //    to lean. Quaternion-rotate (0,1,0): up = q ⊗ (0,1,0).
    const q = rb.rotation();
    const upX = 2 * (q.x * q.y + q.z * q.w);
    const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
    const upZ = 2 * (q.y * q.z - q.x * q.w);
    // cross(up, worldUp) = (up × (0,1,0)) = (-upZ, 0, upX) — wait both terms:
    // (uy*0 - uz*1, uz*0 - ux*0, ux*1 - uy*0) = (-upZ, 0, upX)
    if (upY > -0.5) { // don't fight a full flip — the recovery net handles it
      rb.applyTorqueImpulse(
        { x: -upZ * ASSIST_UPRIGHT_K * dt, y: 0, z: upX * ASSIST_UPRIGHT_K * dt },
        true,
      );
    }

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
      // Debug/e2e exposure — lets Playwright bots assert real position
      // instead of inferring it from elapsed time.
      const t = rb.translation();
      (window as unknown as Record<string, unknown>).__fixerTruckPos = {
        x: Math.round(t.x * 10) / 10,
        y: Math.round(t.y * 10) / 10,
        z: Math.round(t.z * 10) / 10,
        // Track centreline + ground height at the truck — lets e2e drive
        // bots steer and diagnostics compare body vs terrain without
        // importing terrain maths into the page.
        trackX: Math.round(trackCenterX(t.z) * 10) / 10,
        // Road tangent (dx/dz) at the truck's z — for path-following bots.
        trackTanX: Math.round(((trackCenterX(t.z + 4) - trackCenterX(t.z - 4)) / 8) * 100) / 100,
        groundY: Math.round(heightAt(t.x, t.z) * 10) / 10,
        kmh: Math.round(speedAbs * 3.6),
      };

      // ── Recovery net ────────────────────────────────────────────────
      // Trimesh terrain is a shell; a hard enough impact can tunnel the
      // body through or INTO it, and a truck can end up on its side
      // (all three caught on camera by the 2026-06-12 diagnostics).
      // Three triggers, one response: back on the road at the current z,
      // upright, velocity killed.
      //
      // 1. Below the height function — never legitimate by more than ~2.5m
      //    (chassis centre rides ~1.2m ABOVE contact; even airborne over a
      //    dip stays above the sampled column).
      // 2. Wedged — throttle active but only creeping (<1 m/s — a flipped
      //    truck's spinning wheels produce 0.3–0.6 m/s twitches, so the
      //    threshold must sit above them) for 5s straight. "Active" uses a
      //    1.5s recency window, not the instantaneous key state — pulsed
      //    input (humans tapping, bots duty-cycling) must not reset the
      //    timer between taps.
      // 3. Rolled — chassis up-vector tilted past ~70° for 2.5s.
      const ground = heightAt(t.x, t.z);
      if (isRunning && (k.fwd || k.back)) throttleRecency.current = 1.5;
      else throttleRecency.current = Math.max(0, throttleRecency.current - dt * 5);
      const wedged = throttleRecency.current > 0 && speedAbs < 1.0;
      const q = rb.rotation();
      const upY = 1 - 2 * (q.x * q.x + q.z * q.z); // world-up Y of chassis up
      const rolled = upY < 0.35;
      // This block runs every 5th frame, so dt-based timing approximates ×5.
      stuckSeconds.current  = wedged ? stuckSeconds.current + dt * 5 : 0;
      rolledSeconds.current = rolled ? rolledSeconds.current + dt * 5 : 0;

      if (t.y < ground - 2.5 || stuckSeconds.current > 5 || rolledSeconds.current > 2.5) {
        const rx = trackCenterX(t.z);
        rb.setTranslation({ x: rx, y: heightAt(rx, t.z) + 1.8, z: t.z }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        stuckSeconds.current = 0;
        rolledSeconds.current = 0;
        console.warn("[fixer] truck recovered onto track (fell through, wedged, or rolled)");
      }
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={[SPAWN_X, SPAWN_Y, SPAWN_Z]}
      // NO spawn rotation. Chassis +Z = forward, naturally aligns with world +Z.
      canSleep={false}
      ccd
    >
      {/* Chassis collider — sits above wheels so suspension has room.
          NO mass prop: the default ~6 kg arcade body is intentional —
          see the tuning note at the top of this file before changing. */}
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

      {/* ── Cabin glasshouse (z -1.425 → 0.525) ────────────────────────────
            Sill + roof + four pillars, tinted panes between. The solid box
            it replaces hid the interior entirely; this lets Sor read as a
            silhouette through the glass. */}
      {/* sill */}
      <mesh castShadow position={[0, 0.42, -0.45]}>
        <boxGeometry args={[1.72, 0.5, 1.95]} />
        <meshStandardMaterial color={COL_CABIN} roughness={0.9} metalness={0.05} flatShading />
      </mesh>
      {/* roof */}
      <mesh castShadow position={[0, 1.07, -0.45]}>
        <boxGeometry args={[1.72, 0.1, 1.95]} />
        <meshStandardMaterial color={COL_CABIN} roughness={0.9} metalness={0.05} flatShading />
      </mesh>
      {/* pillars — A (front) and C (rear) */}
      {([
        [-0.8, 0.46], [0.8, 0.46], [-0.8, -1.36], [0.8, -1.36],
      ] as [number, number][]).map(([px, pz], i) => (
        <mesh key={i} castShadow position={[px, 0.85, pz]}>
          <boxGeometry args={[0.1, 0.36, 0.1]} />
          <meshStandardMaterial color={COL_CABIN} roughness={0.9} flatShading />
        </mesh>
      ))}
      {/* glass — windshield, sides, rear. Tinted, slightly transparent. */}
      <mesh position={[0, 0.85, 0.5]}>
        <boxGeometry args={[1.58, 0.36, 0.05]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.6} transparent opacity={0.45} />
      </mesh>
      <mesh position={[-0.84, 0.85, -0.45]}>
        <boxGeometry args={[0.05, 0.36, 1.74]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.6} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0.84, 0.85, -0.45]}>
        <boxGeometry args={[0.05, 0.36, 1.74]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.6} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.85, -1.4]}>
        <boxGeometry args={[1.58, 0.36, 0.05]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.6} transparent opacity={0.55} />
      </mesh>

      {/* ── Interior — bench, dash, wheel, and Sor ─────────────────────── */}
      {/* bench seat + backrest */}
      <mesh position={[0, 0.5, -0.85]}>
        <boxGeometry args={[1.5, 0.3, 0.55]} />
        <meshStandardMaterial color={COL_SEAT} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.78, -1.16]}>
        <boxGeometry args={[1.5, 0.5, 0.12]} />
        <meshStandardMaterial color={COL_SEAT} roughness={1} flatShading />
      </mesh>
      {/* dash under the windshield */}
      <mesh position={[0, 0.66, 0.34]}>
        <boxGeometry args={[1.58, 0.14, 0.3]} />
        <meshStandardMaterial color="#211c16" roughness={1} flatShading />
      </mesh>
      {/* Sor — dark seated silhouette, driver's side (LHD → left) */}
      <mesh position={[-0.42, 0.78, -0.72]}>
        <boxGeometry args={[0.44, 0.46, 0.3]} />
        <meshStandardMaterial color={COL_SOR} roughness={1} flatShading />
      </mesh>
      <mesh position={[-0.42, 0.96, -0.68]}>
        <sphereGeometry args={[0.125, 10, 8]} />
        <meshStandardMaterial color={COL_SOR_DARK} roughness={1} flatShading />
      </mesh>
      {/* arms to the wheel */}
      <mesh position={[-0.28, 0.78, -0.4]} rotation={[-1.0, 0, 0.15]}>
        <boxGeometry args={[0.09, 0.4, 0.1]} />
        <meshStandardMaterial color={COL_SOR} roughness={1} flatShading />
      </mesh>
      <mesh position={[-0.56, 0.78, -0.4]} rotation={[-1.0, 0, -0.15]}>
        <boxGeometry args={[0.09, 0.4, 0.1]} />
        <meshStandardMaterial color={COL_SOR} roughness={1} flatShading />
      </mesh>
      {/* steering wheel + column */}
      <mesh position={[-0.42, 0.74, -0.14]} rotation={[-1.25, 0, 0]}>
        <torusGeometry args={[0.16, 0.022, 8, 16]} />
        <meshStandardMaterial color="#0e0c0a" roughness={0.9} />
      </mesh>
      <mesh position={[-0.42, 0.68, 0.02]} rotation={[-1.25, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.3, 6]} />
        <meshStandardMaterial color="#0e0c0a" roughness={0.9} />
      </mesh>
      {/* tasbih — hanging by the windshield. Small. Not waved. */}
      <mesh position={[-0.12, 0.95, 0.42]}>
        <cylinderGeometry args={[0.006, 0.006, 0.12, 4]} />
        <meshStandardMaterial color={COL_TASBIH} roughness={0.8} />
      </mesh>
      <mesh position={[-0.12, 0.87, 0.42]}>
        <sphereGeometry args={[0.022, 6, 5]} />
        <meshStandardMaterial color={COL_TASBIH} roughness={0.8} />
      </mesh>

      {/* ── Side mirrors ───────────────────────────────────────────────── */}
      <mesh position={[-0.94, 0.92, 0.42]}>
        <boxGeometry args={[0.18, 0.03, 0.04]} />
        <meshStandardMaterial color={COL_CABIN} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[-1.04, 0.92, 0.42]}>
        <boxGeometry args={[0.03, 0.16, 0.1]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0.94, 0.92, 0.42]}>
        <boxGeometry args={[0.18, 0.03, 0.04]} />
        <meshStandardMaterial color={COL_CABIN} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[1.04, 0.92, 0.42]}>
        <boxGeometry args={[0.03, 0.16, 0.1]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.5} />
      </mesh>

      {/* ── Rear cargo bed (-Z, behind cabin) ──────────────────────────── */}
      <mesh castShadow position={[0, 0.25, -1.65]}>
        <boxGeometry args={[1.7, 0.5, 0.85]} />
        <meshStandardMaterial color={COL_CHASSIS} roughness={0.95} metalness={0.05} flatShading />
      </mesh>

      {/* ── Cargo cases — the stakes, visible. They slump when lost. ───── */}
      <group
        position={cargoLost >= 1 ? [-0.35, 0.66, -1.5] : [-0.35, 0.69, -1.5]}
        rotation={cargoLost >= 3 ? [0.3, 0.4, 0.8] : cargoLost >= 1 ? [0.12, 0.25, 0.3] : [0, 0, 0]}
      >
        <mesh castShadow>
          <boxGeometry args={[0.55, 0.38, 0.42]} />
          <meshStandardMaterial color={COL_CASE} roughness={0.85} flatShading />
        </mesh>
        <mesh position={[0, 0.1, 0.22]}>
          <boxGeometry args={[0.3, 0.06, 0.02]} />
          <meshStandardMaterial color="#5a625f" roughness={0.6} />
        </mesh>
      </group>
      <group
        position={[0.38, 0.66, -1.78]}
        rotation={cargoLost >= 2 ? [-0.1, -0.2, -0.35] : [0, 0, 0]}
      >
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.32, 0.4]} />
          <meshStandardMaterial color={COL_CASE} roughness={0.85} flatShading />
        </mesh>
        <mesh position={[0, 0.08, 0.21]}>
          <boxGeometry args={[0.26, 0.05, 0.02]} />
          <meshStandardMaterial color="#5a625f" roughness={0.6} />
        </mesh>
      </group>

      {/* ── Roof rack + load ───────────────────────────────────────────── */}
      <mesh castShadow position={[0, 1.18, -0.45]}>
        <boxGeometry args={[1.55, 0.06, 1.7]} />
        <meshStandardMaterial color="#2a2620" roughness={1} metalness={0.1} flatShading />
      </mesh>
      {/* rolled tarp */}
      <mesh castShadow position={[0, 1.32, -0.95]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 1.3, 8]} />
        <meshStandardMaterial color={COL_TARP} roughness={1} flatShading />
      </mesh>
      {/* gear box on the rack */}
      <mesh castShadow position={[0.3, 1.3, -0.1]}>
        <boxGeometry args={[0.5, 0.22, 0.4]} />
        <meshStandardMaterial color="#6e6354" roughness={1} flatShading />
      </mesh>

      {/* ── Jerry can on the rear ──────────────────────────────────────── */}
      <mesh castShadow position={[0.5, 0.34, -2.14]}>
        <boxGeometry args={[0.4, 0.52, 0.16]} />
        <meshStandardMaterial color={COL_JERRY} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.5, 0.63, -2.14]}>
        <boxGeometry args={[0.12, 0.06, 0.1]} />
        <meshStandardMaterial color="#33362a" roughness={0.9} flatShading />
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

      {/* ── Wheels — vehicle controller writes position+rotation each frame.
            Front-left rim is the odd one out — replaced recently. ──────── */}
      <group ref={(el) => { wheelGroups.current[FL] = el; }}><Wheel rim={COL_RIM_ODD} /></group>
      <group ref={(el) => { wheelGroups.current[FR] = el; }}><Wheel /></group>
      <group ref={(el) => { wheelGroups.current[RL] = el; }}><Wheel /></group>
      <group ref={(el) => { wheelGroups.current[RR] = el; }}><Wheel /></group>
    </RigidBody>
  );
}

function Wheel({ rim = COL_RIM }: { rim?: string }) {
  return (
    <>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, WHEEL_W, 18]} />
        <meshStandardMaterial color={COL_TIRE} roughness={0.95} metalness={0} flatShading />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[WHEEL_R * 0.55, WHEEL_R * 0.55, WHEEL_W + 0.02, 12]} />
        <meshStandardMaterial color={rim} roughness={0.6} metalness={0.4} flatShading />
      </mesh>
    </>
  );
}
