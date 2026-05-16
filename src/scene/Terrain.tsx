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
  trackCenterX,
} from "./terrainFn";

// Vertex colour palette — three zones blend by distance from track centre.
// Flat shading means each tri face gets the average of its three vertices,
// which naturally smooths the colour gradient without extra work.
const C_TRACK = new THREE.Color("#7a6a54");  // compressed dirt / tarmac remnant
const C_SAND  = new THREE.Color("#a89570");  // mid-slope warm sand
const C_DUST  = new THREE.Color("#c4b898");  // pale distant dust / rock

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

    // Vertex colours — allocated before we read position so the buffer is
    // the same length as the position attribute.
    const colours = new Float32Array(pos.count * 3);

    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));

      // Distance from the carved track centreline determines colour zone.
      const dist = Math.abs(x - trackCenterX(z));

      // 0–4 m  → compressed track (C_TRACK)
      // 4–18 m → blend to sand (C_SAND)
      // 18+ m  → blend to pale dust (C_DUST)
      if (dist < 4) {
        tmp.copy(C_TRACK);
      } else if (dist < 18) {
        const t = (dist - 4) / 14;          // 0 at edge of track, 1 at 18m
        tmp.copy(C_TRACK).lerp(C_SAND, t);
      } else {
        const t = Math.min(1, (dist - 18) / 20); // 0 at 18m, 1 at 38m+
        tmp.copy(C_SAND).lerp(C_DUST, t);
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
  }, []);

  return (
    // colliders="trimesh" — Rapier reads the mesh vertex/index buffer directly.
    // No separate heights array needed; visual and physics share the same data.
    // DoubleSide on the material is a safety net: if the camera ever dips below
    // terrain (e.g. during a big jump) the ground stays visible.
    <RigidBody type="fixed" colliders="trimesh">
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={1}
          flatShading
          side={THREE.DoubleSide}
        />
      </mesh>
    </RigidBody>
  );
}
