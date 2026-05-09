// Terrain — heightfield mesh + matching Rapier collider.
//
// One mesh, one heightfield collider, both built from the same `heightAt`
// function in terrain.ts. The visual and the physics agree because they
// sample the exact same data.
//
// Replaces the flat ground plane. Future iteration will switch to chunk
// streaming so the world can be longer than the active grid; for now a
// single 240m × 240m grid covers the canonical run.

import { useMemo } from "react";
import * as THREE from "three";
import { RigidBody, HeightfieldCollider } from "@react-three/rapier";
import {
  TERRAIN_SIZE,
  TERRAIN_VERTS,
  TERRAIN_CELLS,
  heightAt,
} from "./terrainFn";

const COL_GROUND = "#a89570"; // warm dawn tan

export default function Terrain() {
  // Heights array — row-major, length = TERRAIN_VERTS².
  // Layout: heights[row * VERTS + col] is the height at world (x = colWorld, z = rowWorld).
  // The Rapier HeightfieldCollider and the visual mesh both use this exact buffer.
  const heights = useMemo<number[]>(() => {
    const arr = new Array<number>(TERRAIN_VERTS * TERRAIN_VERTS);
    for (let i = 0; i < TERRAIN_VERTS; i++) {
      for (let j = 0; j < TERRAIN_VERTS; j++) {
        const x = (j / TERRAIN_CELLS - 0.5) * TERRAIN_SIZE;
        const z = (i / TERRAIN_CELLS - 0.5) * TERRAIN_SIZE;
        arr[i * TERRAIN_VERTS + j] = heightAt(x, z);
      }
    }
    return arr;
  }, []);

  // Visual mesh — custom BufferGeometry built from the same heights so the
  // collision surface and the rendered surface are identical (no z-fighting,
  // no truck-floats-above or truck-clips-into surprises).
  const geometry = useMemo(() => {
    const positions = new Float32Array(TERRAIN_VERTS * TERRAIN_VERTS * 3);
    for (let i = 0; i < TERRAIN_VERTS; i++) {
      for (let j = 0; j < TERRAIN_VERTS; j++) {
        const idx = (i * TERRAIN_VERTS + j) * 3;
        const x = (j / TERRAIN_CELLS - 0.5) * TERRAIN_SIZE;
        const z = (i / TERRAIN_CELLS - 0.5) * TERRAIN_SIZE;
        positions[idx + 0] = x;
        positions[idx + 1] = heights[i * TERRAIN_VERTS + j];
        positions[idx + 2] = z;
      }
    }
    const indices: number[] = [];
    for (let i = 0; i < TERRAIN_CELLS; i++) {
      for (let j = 0; j < TERRAIN_CELLS; j++) {
        const a = i * TERRAIN_VERTS + j;
        const b = a + 1;
        const c = a + TERRAIN_VERTS;
        const d = c + 1;
        // Two triangles per quad. Winding order matters for backface culling.
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    // Compute bounds — without these, R3F's frustum culling treats the
    // mesh as a zero-volume point at origin and culls it whenever the
    // origin isn't in view, which makes the terrain invisible in chase cam.
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }, [heights]);

  return (
    <>
      {/* Physics collider — Rapier-side only, no visual.
          Wrapped in a fixed RigidBody so the heightfield is static.
          NB: RigidBody can affect children's transforms in @react-three/rapier;
          we keep the visual mesh OUTSIDE this body to avoid that quirk. */}
      <RigidBody type="fixed" colliders={false}>
        <HeightfieldCollider
          args={[
            TERRAIN_CELLS,
            TERRAIN_CELLS,
            heights,
            { x: TERRAIN_SIZE, y: 1, z: TERRAIN_SIZE },
          ]}
        />
      </RigidBody>

      {/* Visual mesh — independent of physics. Same geometry data, rendered
          directly. Flat-shaded for the stylized faceted look. */}
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color={COL_GROUND} roughness={1} flatShading />
      </mesh>
    </>
  );
}
