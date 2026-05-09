// Truck — Sor's vehicle. Land Cruiser silhouette built from primitives.
//
// Physics: simple impulse-driven rigid body for now. The real Rapier
// DynamicRayCastVehicleController (proper wheels + suspension + traction)
// is the next milestone — see roadmap in the README.
//
// Visual structure (HJ75-ish, the 70-series workhorse, era-correct for fixers):
//   ─ Chassis lower body (full length, sits on the wheels)
//   ─ Cabin upper box (rear half, where the driver and journalist sit)
//   ─ Hood (front, slightly lower than cabin)
//   ─ Four wheels at corners (visual only; physics is single cuboid)
//   ─ Round headlights
//   ─ Tail lights
//   ─ Roof rack (cargo on roof — period detail)
//   ─ Front bumper / grille hint
//
// Local axes (Three.js convention applied to this truck):
//   +X = right side of truck
//   +Y = up
//   -Z = forward (where the truck drives)
//   +Z = back (where the camera sits)
//
// Materials are dust-on-brown chassis, dark grey-green cabin, with the
// existing yellow-stripe accent removed (Sor's truck is unmarked civilian
// cover — no decals, no flags, no press markings).

import { useRef, useEffect, type RefObject } from "react";
import type { Group } from "three";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider, type RapierRigidBody } from "@react-three/rapier";
import { useKeys } from "../input/useKeys";
import { truckRef } from "./truckRef";
import { useGame } from "../store";
import { SPAWN_X, SPAWN_Y, SPAWN_Z } from "./terrainFn";

// Physics feel — a 70-series Land Cruiser on rough mountain roads.
// Higher LINEAR_DAMPING makes terrain resistance tangible (hills slow you,
// flat hardpack lets you build speed). STEER_TORQUE is deliberately lower
// than arcade — the truck needs speed before it turns crisply.
const ENGINE_FORCE      = 24;    // higher to punch through new damping
const STEER_TORQUE      = 3.2;   // less snap; wide turns need planning
const LINEAR_DAMPING    = 1.6;   // terrain resistance; limits top speed
const ANGULAR_DAMPING   = 4.5;   // steering corrects quickly; no endless spin
const BRAKE_DAMPING_X10 = 10.0;  // firm braking
const MAX_SPEED         = 11;    // m/s ≈ 40 km/h; correct off-road top speed

// Material colors — keep on the cool side so dawn warm light reads on top.
const COL_CHASSIS  = "#5a4f3d";  // dust-coated brown body
const COL_CABIN    = "#4a4538";  // slightly darker green-brown for cabin
const COL_TIRE     = "#1a1814";  // matte black rubber
const COL_RIM      = "#3a3a3a";  // dark steel
const COL_GLASS    = "#0d1418";  // smoked glass
const COL_HEAD     = "#fff5d6";  // warm headlight glass
const COL_TAIL     = "#a02828";  // brake-light red (off when not braking)
const COL_BUMPER   = "#36302a";  // dark unpainted steel

// Dimensions (in metres) — HJ75-ish proportions.
const WHEELBASE   = 2.7;
const TRACK_WIDTH = 1.55;
const WHEEL_R     = 0.42;
const WHEEL_W     = 0.32;

export default function Truck() {
  const body      = useRef<RapierRigidBody>(null);
  const keys      = useKeys();
  const frameNum  = useRef(0);

  // Per-wheel spin refs (inner group, rotated each frame by road speed).
  const wFL = useRef<Group>(null);  // front-left
  const wFR = useRef<Group>(null);  // front-right
  const wRL = useRef<Group>(null);  // rear-left
  const wRR = useRef<Group>(null);  // rear-right

  useEffect(() => {
    truckRef.current = body.current;
    return () => { truckRef.current = null; };
  }, []);

  useFrame((_, dt) => {
    const rb = body.current;
    if (!rb) return;
    const k = keys.current;

    // Gate input on game phase — engine idles while the story card is up.
    const phase = useGame.getState().phase;
    if (phase !== "running") {
      rb.setLinearDamping(LINEAR_DAMPING);
      rb.setAngularDamping(ANGULAR_DAMPING);
      return;
    }

    rb.setLinearDamping(k.brake ? BRAKE_DAMPING_X10 : LINEAR_DAMPING);
    rb.setAngularDamping(ANGULAR_DAMPING);

    const vel = rb.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

    // Drive — gate on MAX_SPEED so the truck has a real top end.
    if (k.fwd || k.back) {
      const belowCap = k.fwd ? speed < MAX_SPEED : speed < MAX_SPEED * 0.6;
      if (belowCap) {
        const rot = rb.rotation();
        const fx = -2 * (rot.x * rot.z + rot.w * rot.y);
        const fz = -1 + 2 * (rot.x * rot.x + rot.y * rot.y);
        const sign = k.fwd ? 1 : -0.6;
        rb.applyImpulse({ x: fx * ENGINE_FORCE * sign, y: 0, z: fz * ENGINE_FORCE * sign }, true);
      }
    }

    // Steer — needs rolling speed; dead slow the truck won't pivot. At speed,
    // torque drops back so high-speed turns require commitment, not a tap.
    if (k.left || k.right) {
      const steerFactor = Math.min(1, speed / 3) * Math.max(0.35, 1 - speed / (MAX_SPEED * 1.4));
      const torque = STEER_TORQUE * steerFactor;
      if (k.left)  rb.applyTorqueImpulse({ x: 0, y:  torque, z: 0 }, true);
      if (k.right) rb.applyTorqueImpulse({ x: 0, y: -torque, z: 0 }, true);
    }

    // Throttled speed push to store — every 5 frames (~12 Hz at 60 fps)
    frameNum.current++;
    if (frameNum.current % 5 === 0) {
      useGame.getState().setSpeed(Math.round(speed * 3.6));
    }

    // Wheel spin — driven by actual Z velocity (truck faces world +Z after
    // the spawn π rotation, so vel.z ≈ forward speed). Pure rolling:
    // Δθ = (vel / radius) * dt. Right-hand rule, +Z travel → +X rotation.
    const spinDelta = (vel.z / WHEEL_R) * dt;
    if (wFL.current) wFL.current.rotation.x += spinDelta;
    if (wFR.current) wFR.current.rotation.x += spinDelta;
    if (wRL.current) wRL.current.rotation.x += spinDelta;
    if (wRR.current) wRR.current.rotation.x += spinDelta;
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      mass={1800}
      position={[SPAWN_X, SPAWN_Y, SPAWN_Z]}
      // Face north (truck local -Z is forward; rotate ~ to point along +Z driving direction).
      // Spawn rotation = 0 means truck faces -Z, but we want it facing +Z (north).
      // Rotate π around Y so headlights point north.
      rotation={[0, Math.PI, 0]}
      enabledRotations={[false, true, false]}
    >
      {/* Single cuboid collider sized to the chassis — covers wheels too so
          the truck rolls on its wheels without per-wheel physics. */}
      <CuboidCollider args={[0.95, 0.85, 2.25]} />

      {/* ── Chassis lower body — full length, sits between the wheels ─── */}
      <mesh castShadow position={[0, -0.05, 0]}>
        <boxGeometry args={[1.8, 0.7, 4.2]} />
        <meshStandardMaterial color={COL_CHASSIS} roughness={0.85} metalness={0.05} />
      </mesh>

      {/* ── Hood (front lower box) — sits forward of the cabin ─────────── */}
      <mesh castShadow position={[0, 0.45, -1.15]}>
        <boxGeometry args={[1.7, 0.45, 1.6]} />
        <meshStandardMaterial color={COL_CHASSIS} roughness={0.85} metalness={0.05} />
      </mesh>

      {/* ── Cabin (upper box, rear of hood) — driver + passenger ───────── */}
      <mesh castShadow position={[0, 0.65, 0.45]}>
        <boxGeometry args={[1.72, 0.95, 1.95]} />
        <meshStandardMaterial color={COL_CABIN} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* ── Windshield ─────────────────────────────────────────────────── */}
      <mesh position={[0, 0.7, -0.55]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1.55, 0.7, 0.05]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.8} />
      </mesh>

      {/* ── Side windows (left / right of cabin) ───────────────────────── */}
      <mesh position={[-0.86, 0.75, 0.45]}>
        <boxGeometry args={[0.05, 0.5, 1.6]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[ 0.86, 0.75, 0.45]}>
        <boxGeometry args={[0.05, 0.5, 1.6]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.2} metalness={0.8} />
      </mesh>

      {/* ── Rear cargo bed cap (low, behind cabin) ─────────────────────── */}
      <mesh castShadow position={[0, 0.25, 1.65]}>
        <boxGeometry args={[1.7, 0.5, 0.85]} />
        <meshStandardMaterial color={COL_CHASSIS} roughness={0.95} metalness={0.05} />
      </mesh>

      {/* ── Roof rack — flat box on top, the period detail that says "this
              truck has been doing this for years" ────────────────────────── */}
      <mesh castShadow position={[0, 1.18, 0.45]}>
        <boxGeometry args={[1.55, 0.06, 1.7]} />
        <meshStandardMaterial color="#2a2620" roughness={1} metalness={0.1} />
      </mesh>

      {/* ── Front bumper ───────────────────────────────────────────────── */}
      <mesh castShadow position={[0, 0.05, -2.0]}>
        <boxGeometry args={[1.75, 0.18, 0.15]} />
        <meshStandardMaterial color={COL_BUMPER} roughness={0.7} metalness={0.3} />
      </mesh>

      {/* ── Headlights — round, recessed. Cylinder default axis is Y, so
              rotate π/2 around X to make the round face point forward (-Z). */}
      <mesh position={[-0.55, 0.45, -1.97]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
        <meshStandardMaterial color={COL_HEAD} emissive={COL_HEAD} emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[ 0.55, 0.45, -1.97]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
        <meshStandardMaterial color={COL_HEAD} emissive={COL_HEAD} emissiveIntensity={1.6} />
      </mesh>

      {/* ── Tail lights — small red boxes flanking the cargo cap ──────── */}
      <mesh position={[-0.78, 0.35, 2.07]}>
        <boxGeometry args={[0.18, 0.16, 0.04]} />
        <meshStandardMaterial color={COL_TAIL} emissive={COL_TAIL} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[ 0.78, 0.35, 2.07]}>
        <boxGeometry args={[0.18, 0.16, 0.04]} />
        <meshStandardMaterial color={COL_TAIL} emissive={COL_TAIL} emissiveIntensity={0.2} />
      </mesh>

      {/* ── Wheels — visual; spin group driven by velocity each frame ─── */}
      <Wheel position={[-TRACK_WIDTH / 2, -0.5, -WHEELBASE / 2]} spinRef={wFL} />
      <Wheel position={[ TRACK_WIDTH / 2, -0.5, -WHEELBASE / 2]} spinRef={wFR} />
      <Wheel position={[-TRACK_WIDTH / 2, -0.5,  WHEELBASE / 2]} spinRef={wRL} />
      <Wheel position={[ TRACK_WIDTH / 2, -0.5,  WHEELBASE / 2]} spinRef={wRR} />
    </RigidBody>
  );
}

// Single wheel — outer group positions the wheel at its corner; inner spin
// group (spinRef) is rotated each frame by road speed so the tyre visually
// rolls. Cylinder is created along Y, rotated ±π/2 around Z so the round
// face points outward along the truck's X axis (the axle direction).
function Wheel({
  position,
  spinRef,
}: {
  position: [number, number, number];
  spinRef: RefObject<Group>;
}) {
  return (
    <group position={position}>
      {/* Spin group — rotation.x is driven by velocity in useFrame */}
      <group ref={spinRef}>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[WHEEL_R, WHEEL_R, WHEEL_W, 18]} />
          <meshStandardMaterial color={COL_TIRE} roughness={0.95} metalness={0.0} />
        </mesh>
        {/* Rim — inner disc, slightly inset */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[WHEEL_R * 0.55, WHEEL_R * 0.55, WHEEL_W + 0.02, 12]} />
          <meshStandardMaterial color={COL_RIM} roughness={0.6} metalness={0.4} />
        </mesh>
      </group>
    </group>
  );
}
