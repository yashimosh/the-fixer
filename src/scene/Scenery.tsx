// Scenery — static environmental props along the West Mosul route.
//
// No assets — all geometry is procedural Three.js primitives.
// Objects are purely visual (no physics bodies): wall slabs, rubble clusters,
// and burnt vehicle husks. Placement uses a seeded LCG so the layout is
// deterministic across reloads.
//
// Design constraints:
//   - Flat-shaded boxes only — consistent with Bruno Simon / Over the Hill ref
//   - All objects placed ≥ 12 m from track centerline (driving clearance)
//   - Heights sampled from heightAt() so objects sit flush on terrain
//   - Color palette: warm concrete greys, dark char, sand — no saturated tones
//
// Object inventory (deterministic, seeded from index):
//   WallSlab    — tall thin boxes, 2–5 m high. Shell walls of bombed buildings.
//                 Placed 15–45 m from track, both sides, slight random rotation.
//   RubblePile  — flat scatter of small boxes at ground level.
//                 3–6 boxes per pile, each with independent tilt and scale.
//   BurntHusk   — a collapsed vehicle: flat low box, 4 small cylinder-wheels.

import { useMemo } from "react";
import * as THREE from "three";
import { trackCenterX, heightAt } from "./terrainFn";

// ── Palette ────────────────────────────────────────────────────────────────
const COL_CONCRETE   = "#857b71";   // main wall tone — warm mid grey
const COL_CONCRETE_D = "#635c54";   // shadow face / darker slabs
const COL_RUBBLE_A   = "#9e8e7c";   // light rubble
const COL_RUBBLE_B   = "#7a6f62";   // dark rubble
const COL_CHAR       = "#3e3836";   // burnt / charred

// ── Seeded pseudo-random ───────────────────────────────────────────────────
// LCG — deterministic, fast, no import needed.
function lcg(seed: number) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Reusable shared geometries ─────────────────────────────────────────────
const GEO_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

// ── Helper: place an object at (x, z) snapped to terrain ──────────────────
function groundedY(x: number, z: number, halfHeight: number): number {
  return heightAt(x, z) + halfHeight;
}

// ── WallSlab ──────────────────────────────────────────────────────────────
interface WallSlabProps {
  x: number; z: number;
  width: number; height: number; depth: number;
  rotY: number;
  dark?: boolean;
}

function WallSlab({ x, z, width, height, depth, rotY, dark }: WallSlabProps) {
  const y = groundedY(x, z, height / 2);
  return (
    <mesh
      position={[x, y, z]}
      rotation={[0, rotY, 0]}
      scale={[width, height, depth]}
      geometry={GEO_UNIT_BOX}
      castShadow
    >
      <meshStandardMaterial
        color={dark ? COL_CONCRETE_D : COL_CONCRETE}
        roughness={0.92}
        flatShading
      />
    </mesh>
  );
}

// ── RubbleChunk ───────────────────────────────────────────────────────────
interface RubbleChunkProps {
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  rx: number; rz: number;
  light?: boolean;
}

function RubbleChunk({ x, y, z, sx, sy, sz, rx, rz, light }: RubbleChunkProps) {
  return (
    <mesh
      position={[x, y, z]}
      rotation={[rx, 0, rz]}
      scale={[sx, sy, sz]}
      geometry={GEO_UNIT_BOX}
      receiveShadow
    >
      <meshStandardMaterial
        color={light ? COL_RUBBLE_A : COL_RUBBLE_B}
        roughness={1}
        flatShading
      />
    </mesh>
  );
}

// ── BurntHusk ─────────────────────────────────────────────────────────────
interface HuskProps { x: number; z: number; rotY: number }

function BurntHusk({ x, z, rotY }: HuskProps) {
  const gy = heightAt(x, z);
  return (
    <group position={[x, gy, z]} rotation={[0, rotY, 0]}>
      {/* Body */}
      <mesh position={[0, 0.45, 0]} geometry={GEO_UNIT_BOX} scale={[2.8, 0.7, 1.4]} castShadow>
        <meshStandardMaterial color={COL_CHAR} roughness={1} flatShading />
      </mesh>
      {/* Cab stub */}
      <mesh position={[0.5, 0.95, 0]} geometry={GEO_UNIT_BOX} scale={[1.0, 0.6, 1.25]} castShadow>
        <meshStandardMaterial color={COL_CHAR} roughness={1} flatShading />
      </mesh>
      {/* Wheels — collapsed flat */}
      {([ [-1.0, -0.55], [1.0, -0.55], [-1.0, 0.55], [1.0, 0.55] ] as [number, number][]).map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.2, lz]} geometry={GEO_UNIT_BOX} scale={[0.4, 0.4, 0.18]}>
          <meshStandardMaterial color="#2a2826" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function Scenery() {
  const objects = useMemo(() => {
    const walls:   WallSlabProps[]    = [];
    const rubbles: { chunks: RubbleChunkProps[] }[] = [];
    const husks:   HuskProps[]        = [];

    const rng = lcg(0xf13e40);   // fixed seed — layout never changes

    // Place features at Z intervals across the 220m run (-100 → +120)
    // Step 15 m per "slot", alternating L/R, with skip chance
    for (let z = -95; z < 115; z += 12) {
      const side = rng() > 0.5 ? 1 : -1;
      const type = rng();

      // Track center at this Z — clearance from here
      const cx = trackCenterX(z);

      // ── Wall slab ─────────────────────────────────────────────────────
      if (type < 0.45) {
        const dist = 14 + rng() * 28;       // 14–42 m from track
        const x    = cx + side * dist;
        const w    = 0.3 + rng() * 0.35;    // wall thickness 0.3–0.65 m
        const h    = 2.2 + rng() * 2.8;     // height 2.2–5 m
        const l    = 3.5 + rng() * 5.5;     // wall length 3.5–9 m
        const rotY = (rng() - 0.5) * 0.4;   // ±0.2 rad tilt

        walls.push({ x, z, width: l, height: h, depth: w, rotY, dark: rng() > 0.6 });

        // A secondary lower slab adjacent — collapsed section
        if (rng() > 0.55) {
          const ox = x + (rng() - 0.5) * 4;
          const oz = z + (rng() - 0.5) * 3;
          walls.push({
            x: ox, z: oz,
            width: 1.5 + rng() * 3, height: 0.8 + rng() * 1.4, depth: w,
            rotY: rotY + (rng() - 0.5) * 0.6,
            dark: true,
          });
        }
      }

      // ── Rubble pile ───────────────────────────────────────────────────
      else if (type < 0.80) {
        const dist   = 12 + rng() * 22;
        const cx2    = cx + side * dist;
        const chunks: RubbleChunkProps[] = [];
        const count  = 3 + Math.floor(rng() * 4);  // 3–6 chunks per pile
        for (let c = 0; c < count; c++) {
          const bx = cx2 + (rng() - 0.5) * 3;
          const bz = z   + (rng() - 0.5) * 3;
          const sy = 0.12 + rng() * 0.4;
          const gy = heightAt(bx, bz) + sy / 2;
          chunks.push({
            x: bx, y: gy, z: bz,
            sx: 0.3 + rng() * 0.9,
            sy,
            sz: 0.3 + rng() * 0.9,
            rx: (rng() - 0.5) * 0.5,
            rz: (rng() - 0.5) * 0.5,
            light: rng() > 0.5,
          });
        }
        rubbles.push({ chunks });
      }

      // ── Burnt husk ────────────────────────────────────────────────────
      else {
        const dist = 18 + rng() * 25;
        const x    = cx + side * dist;
        husks.push({ x, z, rotY: rng() * Math.PI * 2 });
      }
    }

    return { walls, rubbles, husks };
  }, []);

  return (
    <>
      {objects.walls.map((p, i) => <WallSlab key={`w${i}`} {...p} />)}
      {objects.rubbles.map((pile, i) =>
        pile.chunks.map((c, j) => <RubbleChunk key={`r${i}-${j}`} {...c} />)
      )}
      {objects.husks.map((h, i) => <BurntHusk key={`h${i}`} {...h} />)}
    </>
  );
}
