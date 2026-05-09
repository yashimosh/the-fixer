// Terrain — heightfield mesh + matching Rapier collider.
//
// Physics: colliders="trimesh" on the RigidBody auto-builds Rapier's collision
// shape directly from the mesh geometry — same vertex buffer as the visual,
// so visual and physics are guaranteed to agree. HeightfieldCollider was tried
// first but has a subtle row/column-major convention that's easy to get wrong;
// trimesh is simpler and just as fast for a single static terrain.
//
// Visual: PlaneGeometry displaced by heightAt per vertex. Flat shading gives
// the polygonal look consistent with the reference set (Bruno Simon,
// Over the Hill, Tiny Delivery).
//
// Single 240m × 240m grid covers the canonical run. Future iteration switches
// to chunk streaming once the run needs to be longer than the active grid.

import { useMemo } from "react";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import {
  TERRAIN_SIZE,
  TERRAIN_CELLS,
  heightAt,
} from "./terrainFn";

const COL_GROUND = "#a89570"; // warm dawn tan

export default function Terrain() {
  // Visual mesh — PlaneGeometry displaced by heightAt per vertex.
  // PlaneGeometry gives us correct UVs, indices, and a proper bounding sphere
  // out of the box. We rotate it flat then displace Y.
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
    // colliders="trimesh" — Rapier reads the mesh vertex/index buffer directly.
    // No separate heights array needed; visual and physics share the same data.
    // DoubleSide on the material is a safety net: if the camera ever dips below
    // terrain (e.g. during a big jump) the ground stays visible.
    <RigidBody type="fixed" colliders="trimesh">
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color={COL_GROUND}
          roughness={1}
          flatShading
          side={THREE.DoubleSide}
        />
      </mesh>
    </RigidBody>
  );
}
