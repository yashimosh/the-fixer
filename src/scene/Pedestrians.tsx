// Pedestrians — civilian figures along the route.
//
// West Mosul, June 2017. Civilians are returning to a city that's mostly
// rubble. A woman walking with a bag past a collapsed wall. A boy on the
// shoulder of the road. A man carrying a jerrycan from a tanker truck.
// These are NOT story characters (Sor doesn't interact, can't hit them —
// they live outside the truck's collision world). They're scene texture.
//
// Built from primitives: a tall thin torso, a sphere head, two leg cuboids
// that swing on a sine wave. Coat is a flat-shaded box around the torso.
// All deterministic — same seed, same layout every run.
//
// Placement: hard-coded along Z with side offset from track centre.
// Distances 4–10m off track so they read at car speed.

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { heightAt, trackCenterX } from "./terrainFn";

// ── Palette — warm muted civilian clothing ─────────────────────────────────
const COL_COAT_A    = "#5a4838";  // worn dark coat
const COL_COAT_B    = "#7d5a3a";  // ochre overcoat
const COL_COAT_C    = "#3e4a4c";  // dusty teal jacket
const COL_PANTS     = "#2a2620";
const COL_SKIN      = "#c89970";  // light skin tone
const COL_HEAD_DARK = "#1a1414";  // hair / headscarf
const COL_BAG       = "#48413a";  // canvas bag

// ── Pedestrian definition ─────────────────────────────────────────────────
interface PedSpec {
  /** Position along route (world Z). Height is sampled from terrain. */
  z: number;
  /** Offset from track centre. Positive = right side of road. */
  sideOffset: number;
  /** Walking direction in radians (Y rotation). 0 = facing world +Z. */
  facing: number;
  /** Walking speed in m/s. 0 = standing still. */
  walkSpeed: number;
  /** Coat colour. */
  coat: string;
  /** True for headscarf (hair completely covered), false for visible hair. */
  headscarf: boolean;
  /** Carrying a bag? */
  bag: boolean;
  /** Phase offset for leg swing — staggers multiple peds so they don't sync. */
  phase: number;
}

// Hand-placed pedestrians along the 220m route (SPAWN_Z=-100 → END_Z=+120).
// One every 30–45m, alternating sides, varied poses.
const PEDS: PedSpec[] = [
  // Near the spawn — first thing the player sees after leaving the checkpoint
  { z: -65, sideOffset:  6,    facing: -Math.PI / 2, walkSpeed: 0.9, coat: COL_COAT_A, headscarf: true,  bag: true,  phase: 0.0 },
  // Mid-route — walking toward the truck
  { z: -20, sideOffset: -7,    facing:  Math.PI,     walkSpeed: 1.1, coat: COL_COAT_B, headscarf: false, bag: false, phase: 1.3 },
  // Standing still, watching — beside a rubble pile
  { z:  10, sideOffset:  8.5,  facing: -Math.PI / 2, walkSpeed: 0,   coat: COL_COAT_C, headscarf: true,  bag: false, phase: 0.0 },
  // Walking the same way as the truck (player overtakes them)
  { z:  45, sideOffset: -5.5,  facing:  0,           walkSpeed: 0.7, coat: COL_COAT_A, headscarf: false, bag: true,  phase: 2.1 },
  // A pair near the end — one walking, one standing
  { z:  88, sideOffset:  7,    facing: -Math.PI / 2, walkSpeed: 1.0, coat: COL_COAT_B, headscarf: true,  bag: false, phase: 0.7 },
  { z:  92, sideOffset:  7.6,  facing:  Math.PI / 4, walkSpeed: 0,   coat: COL_COAT_C, headscarf: true,  bag: true,  phase: 0.0 },
];

// ── Reusable geometries ────────────────────────────────────────────────────
const GEO_HEAD = new THREE.SphereGeometry(0.13, 10, 8);
const GEO_TORSO = new THREE.BoxGeometry(0.42, 0.55, 0.22);
const GEO_LEG = new THREE.BoxGeometry(0.16, 0.55, 0.18);
const GEO_ARM = new THREE.BoxGeometry(0.12, 0.45, 0.13);
const GEO_BAG = new THREE.BoxGeometry(0.22, 0.28, 0.12);

// ── Single pedestrian ─────────────────────────────────────────────────────
function Pedestrian({ spec }: { spec: PedSpec }) {
  const root      = useRef<Group>(null);
  const legL      = useRef<Group>(null);
  const legR      = useRef<Group>(null);
  const armL      = useRef<Group>(null);
  const armR      = useRef<Group>(null);

  // Start position. Y is terrain height; the body's origin is the feet.
  const startX = trackCenterX(spec.z) + spec.sideOffset;
  const startY = heightAt(startX, spec.z);

  // Walking state — pedestrian moves along its facing direction at walkSpeed.
  const walkedDist = useRef(0);

  useFrame((state, dt) => {
    if (!root.current) return;

    // Total elapsed for leg-swing animation. Phase staggers multiple peds.
    const t = state.clock.elapsedTime + spec.phase;

    // Walk forward in facing direction.
    if (spec.walkSpeed > 0) {
      walkedDist.current += spec.walkSpeed * dt;
      // Loop after 30m so pedestrians don't wander off-map.
      if (walkedDist.current > 30) walkedDist.current -= 60;
      else if (walkedDist.current < -30) walkedDist.current += 60;

      const dx = Math.sin(spec.facing) * walkedDist.current;
      const dz = Math.cos(spec.facing) * walkedDist.current;
      const wx = startX + dx;
      const wz = spec.z + dz;
      const wy = heightAt(wx, wz);

      root.current.position.set(wx, wy, wz);
    }

    // Leg + arm swing — sine wave, ~2 Hz at normal walk speed.
    if (spec.walkSpeed > 0) {
      const swing = Math.sin(t * 5.5) * 0.4;
      if (legL.current) legL.current.rotation.x =  swing;
      if (legR.current) legR.current.rotation.x = -swing;
      if (armL.current) armL.current.rotation.x = -swing * 0.7;
      if (armR.current) armR.current.rotation.x =  swing * 0.7;
    }
  });

  // Slight body bob for walking peds — purely visual.
  const bodyBob = spec.walkSpeed > 0 ? 0.02 : 0;

  return (
    <group ref={root} position={[startX, startY, spec.z]} rotation={[0, spec.facing, 0]}>
      {/* Body root sits at feet — components positioned above */}
      {/* Torso (with coat colour) — chest centre at 1.05m */}
      <mesh castShadow position={[0, 1.05 + bodyBob, 0]} geometry={GEO_TORSO}>
        <meshStandardMaterial color={spec.coat} roughness={1} flatShading />
      </mesh>

      {/* Head — sphere on top of torso, slight forward tilt
          (head centre at ~1.5m for an average adult) */}
      <mesh castShadow position={[0, 1.48 + bodyBob, 0.02]} geometry={GEO_HEAD}>
        <meshStandardMaterial color={spec.headscarf ? COL_HEAD_DARK : COL_SKIN} roughness={1} flatShading />
      </mesh>

      {/* Headscarf cover — flat box over the head, blocks the sphere top */}
      {spec.headscarf && (
        <mesh position={[0, 1.55 + bodyBob, 0]} scale={[0.32, 0.20, 0.34]} geometry={new THREE.BoxGeometry(1, 1, 1)}>
          <meshStandardMaterial color={spec.coat} roughness={1} flatShading />
        </mesh>
      )}

      {/* Legs — pivot at hip (top of leg). Origin at leg-top so rotation
          swings the foot, not the head. */}
      <group ref={legL} position={[-0.12, 0.78, 0]}>
        <mesh castShadow position={[0, -0.275, 0]} geometry={GEO_LEG}>
          <meshStandardMaterial color={COL_PANTS} roughness={1} flatShading />
        </mesh>
      </group>
      <group ref={legR} position={[0.12, 0.78, 0]}>
        <mesh castShadow position={[0, -0.275, 0]} geometry={GEO_LEG}>
          <meshStandardMaterial color={COL_PANTS} roughness={1} flatShading />
        </mesh>
      </group>

      {/* Arms — pivot at shoulder */}
      <group ref={armL} position={[-0.27, 1.30 + bodyBob, 0]}>
        <mesh castShadow position={[0, -0.225, 0]} geometry={GEO_ARM}>
          <meshStandardMaterial color={spec.coat} roughness={1} flatShading />
        </mesh>
      </group>
      <group ref={armR} position={[0.27, 1.30 + bodyBob, 0]}>
        <mesh castShadow position={[0, -0.225, 0]} geometry={GEO_ARM}>
          <meshStandardMaterial color={spec.coat} roughness={1} flatShading />
        </mesh>
      </group>

      {/* Bag — held in left hand, slightly forward */}
      {spec.bag && (
        <mesh castShadow position={[-0.34, 0.88 + bodyBob, 0.02]} geometry={GEO_BAG}>
          <meshStandardMaterial color={COL_BAG} roughness={1} flatShading />
        </mesh>
      )}
    </group>
  );
}

// ── Pedestrians root — renders all peds in PEDS list ──────────────────────
export default function Pedestrians() {
  return (
    <>
      {PEDS.map((spec, i) => <Pedestrian key={i} spec={spec} />)}
    </>
  );
}
