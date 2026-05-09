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

  // Visual mesh — start from PlaneGeometry (which has correct attributes
  // including UVs and a proper bounding sphere) and displace its vertices
  // by sampling heightAt. Less code than a custom BufferGeometry and
  // avoids the from-scratch frustum-culling pitfalls.
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      TERRAIN_SIZE, TERRAIN_SIZE,
      TERRAIN_CELLS, TERRAIN_CELLS,
    );
    // PlaneGeometry lies in the XY plane (faces +Z). Rotate to lie in XZ
    // (faces +Y up) BEFORE displacing so the sampled height goes to world Y.
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }, []);

  return (
    <RigidBody type="fixed" colliders={false}>
      {/* Physics collider — Rapier reads heights array directly. */}
      <HeightfieldCollider
        args={[
          TERRAIN_CELLS,
          TERRAIN_CELLS,
          heights,
          { x: TERRAIN_SIZE, y: 1, z: TERRAIN_SIZE },
        ]}
      />
      {/* Visual mesh — child of the RigidBody (proven pattern matches Truck). */}
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color={COL_GROUND} roughness={1} flatShading />
      </mesh>
    </RigidBody>
  );
}
