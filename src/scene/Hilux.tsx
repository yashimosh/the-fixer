// Hilux — the vehicle ahead. World anchor for the third cargo-risk beat.
//
// "The Hilux ahead has a green flag in the window. You keep two hundred
// metres between you. Standard."
//
// Behaviour: hidden until the truck crosses TRIGGER_TRUCK_Z, then spawns
// SPAWN_GAP metres ahead and drives the track centreline at a steady
// 9.5 m/s — slower than the truck's 14 m/s ceiling, so an impatient player
// CAN close the gap (which is exactly what the speed check at the beat
// punishes), but never actually catch it before the run ends.
//
// Visual-only — no physics body. It grounds itself with heightAt() and
// follows trackCenterX(), yawed to the track tangent. At 200m it lives in
// the fog band; a pale silhouette with a green rectangle in the rear glass.
// That's all the beat needs (Rule 5 — don't over-literalise).

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Object3D } from "three";
import { truckRef } from "./truckRef";
import { useGame } from "../store";
import { trackCenterX, heightAt } from "./terrainFn";

const TRIGGER_TRUCK_Z = 340;   // truck z that wakes the Hilux
const SPAWN_GAP       = 220;   // metres ahead of the truck at spawn
const SPEED           = 9.5;   // m/s — a careful local driver's pace
const WHEEL_R         = 0.36;

const COL_BODY  = "#d9d3c4";   // dusty white — the region's default Hilux
const COL_GLASS = "#10171c";
const COL_TIRE  = "#1a1814";
const COL_FLAG  = "#2f7d3a";   // the green rectangle in the rear window

export default function Hilux() {
  const root   = useRef<Group>(null);
  const wheels = useRef<(Object3D | null)[]>([null, null, null, null]);
  const state  = useRef({ active: false, z: 0, spin: 0 });

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    const rb = truckRef.current;
    const s = state.current;

    if (!s.active) {
      g.visible = false;
      if (!rb) return;
      if (useGame.getState().phase !== "running") return;
      const tz = rb.translation().z;
      if (tz < TRIGGER_TRUCK_Z) return;
      s.active = true;
      s.z = tz + SPAWN_GAP;
      g.visible = true;
    }

    s.z += SPEED * dt;
    const x = trackCenterX(s.z);
    const y = heightAt(x, s.z);
    // Yaw from track tangent (finite difference) — faces where it drives.
    const yaw = Math.atan2(trackCenterX(s.z + 2) - trackCenterX(s.z - 2), 4);

    g.position.set(x, y + WHEEL_R, s.z);
    g.rotation.set(0, yaw, 0);

    s.spin += (SPEED / WHEEL_R) * dt;
    for (const w of wheels.current) {
      if (w) w.rotation.x = s.spin;
    }
  });

  return (
    <group ref={root} visible={false}>
      {/* flatbed + cab — +Z forward, same convention as the truck */}
      <mesh castShadow position={[0, 0.55, -0.3]}>
        <boxGeometry args={[1.7, 0.55, 4.6]} />
        <meshStandardMaterial color={COL_BODY} roughness={0.85} flatShading />
      </mesh>
      <mesh castShadow position={[0, 1.1, 0.65]}>
        <boxGeometry args={[1.6, 0.6, 1.5]} />
        <meshStandardMaterial color={COL_BODY} roughness={0.85} flatShading />
      </mesh>
      {/* hood */}
      <mesh castShadow position={[0, 0.78, 1.75]}>
        <boxGeometry args={[1.6, 0.35, 1.1]} />
        <meshStandardMaterial color={COL_BODY} roughness={0.85} flatShading />
      </mesh>
      {/* rear glass — and the green flag behind it */}
      <mesh position={[0, 1.15, -0.12]}>
        <boxGeometry args={[1.45, 0.42, 0.04]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.25} metalness={0.7} />
      </mesh>
      <mesh position={[0.3, 1.12, -0.07]}>
        <boxGeometry args={[0.5, 0.32, 0.02]} />
        <meshStandardMaterial color={COL_FLAG} roughness={0.9} />
      </mesh>
      {/* windshield */}
      <mesh position={[0, 1.15, 1.42]}>
        <boxGeometry args={[1.45, 0.42, 0.04]} />
        <meshStandardMaterial color={COL_GLASS} roughness={0.25} metalness={0.7} />
      </mesh>
      {/* wheels */}
      {([
        [-0.85, 1.45], [0.85, 1.45], [-0.85, -1.5], [0.85, -1.5],
      ] as [number, number][]).map(([wx, wz], i) => (
        <group
          key={i}
          position={[wx, 0, wz]}
          ref={(el) => { wheels.current[i] = el; }}
        >
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.26, 14]} />
            <meshStandardMaterial color={COL_TIRE} roughness={0.95} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}
