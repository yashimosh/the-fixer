// Terrain — chunk-streamed heightfield + matching Rapier colliders.
//
// The world materialises in 100m slabs around the truck (see terrainFn for
// the chunk constants). Each chunk is:
//   - a displaced PlaneGeometry with vertex colours + a trimesh collider
//     (visual and physics share the same vertex buffer, guaranteed agreement)
//   - one merged scenery mesh (walls / rubble / husks — see sceneryFn),
//     visual only, OUTSIDE the RigidBody so it gets no collider
//
// Streaming: a low-frequency useFrame watcher reads the truck z and updates
// the active [min, max] chunk index range in React state. React mounts and
// unmounts chunk components; R3F disposes geometry on unmount, @react-three/
// rapier frees the trimesh collider. Chunks ahead spawn inside the fog
// (CHUNK_AHEAD 360m vs fog far 380m) so pop-in is invisible.
//
// Flat shading hides chunk seams: face normals are computed in-shader from
// derivatives, and shared-edge vertices sample identical heightAt() values.

import { useMemo, useState, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import {
  CHUNK_LENGTH,
  CHUNK_WIDTH,
  CHUNK_SEGS_X,
  CHUNK_SEGS_Z,
  activeChunkRange,
  heightAt,
  trackCenterX,
  SPAWN_Z,
} from "./terrainFn";
import { buildSceneryGeometry } from "./sceneryFn";

// Vertex colour palette — three zones blend by distance from track centre.
const C_TRACK = new THREE.Color("#7a6a54");  // compressed dirt / tarmac remnant
const C_SAND  = new THREE.Color("#a89570");  // mid-slope warm sand
const C_DUST  = new THREE.Color("#c4b898");  // pale distant dust / rock

function buildChunkGeometry(index: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(
    CHUNK_WIDTH, CHUNK_LENGTH,
    CHUNK_SEGS_X, CHUNK_SEGS_Z,
  );
  // PlaneGeometry lies in the XY plane (faces +Z). Rotate to lie in XZ
  // (faces +Y up), then shift to the chunk's world-z slot. Vertices carry
  // WORLD coordinates — the mesh itself sits at the origin, which keeps
  // heightAt() sampling and physics trivially aligned.
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, index * CHUNK_LENGTH + CHUNK_LENGTH / 2);

  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));

    // Distance from the track centreline determines colour zone:
    // 0–4 m track → 4–18 m blend to sand → 18 m+ blend to pale dust.
    const dist = Math.abs(x - trackCenterX(z));
    if (dist < 4) {
      tmp.copy(C_TRACK);
    } else if (dist < 18) {
      tmp.copy(C_TRACK).lerp(C_SAND, (dist - 4) / 14);
    } else {
      tmp.copy(C_SAND).lerp(C_DUST, Math.min(1, (dist - 18) / 20));
    }
    colours[i * 3]     = tmp.r;
    colours[i * 3 + 1] = tmp.g;
    colours[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

// ── One chunk: terrain slab (with collider) + merged scenery (visual) ──────
function TerrainChunk({ index }: { index: number }) {
  const terrainGeo = useMemo(() => buildChunkGeometry(index), [index]);
  const sceneryGeo = useMemo(() => buildSceneryGeometry(index), [index]);

  return (
    <group>
      {/* colliders="trimesh" — Rapier reads the mesh vertex/index buffer
          directly. DoubleSide is a safety net if the camera dips below
          terrain during a hard landing. */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh geometry={terrainGeo} receiveShadow>
          <meshStandardMaterial
            vertexColors
            roughness={1}
            flatShading
            side={THREE.DoubleSide}
          />
        </mesh>
      </RigidBody>

      {/* Scenery sits OUTSIDE the RigidBody — visual only, no collider. */}
      {sceneryGeo && (
        <mesh geometry={sceneryGeo} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.95} flatShading />
        </mesh>
      )}
    </group>
  );
}

// ── Chunk manager ──────────────────────────────────────────────────────────
import { truckRef } from "./truckRef";

export default function Terrain() {
  const [range, setRange] = useState<[number, number]>(() => activeChunkRange(SPAWN_Z));
  const frame = useRef(0);

  useFrame(() => {
    // Streaming check every 20 frames (~3 Hz) — chunk churn is slow.
    frame.current++;
    if (frame.current % 20 !== 0) return;
    const rb = truckRef.current;
    if (!rb) return;
    const next = activeChunkRange(rb.translation().z);
    if (next[0] !== range[0] || next[1] !== range[1]) setRange(next);
  });

  const chunks: number[] = [];
  for (let i = range[0]; i <= range[1]; i++) chunks.push(i);

  return (
    <>
      {chunks.map((i) => <TerrainChunk key={i} index={i} />)}
    </>
  );
}
