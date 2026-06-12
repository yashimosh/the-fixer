// sceneryFn — per-chunk environmental props, merged into ONE geometry.
//
// West Mosul, June 2017. Shell walls of bombed buildings, rubble scatter,
// burnt vehicle husks. All boxes, all flat-shaded, all baked into a single
// BufferGeometry per chunk with vertex colours (one draw call per chunk —
// the Border Run geometry-merging lesson applied).
//
// Placement is deterministic: the LCG is seeded from the chunk index, so a
// chunk always regenerates identically when it streams back in.
//
// Design constraints (unchanged from the original Scenery component):
//   - Flat-shaded boxes only — consistent with Bruno Simon / Over the Hill ref
//   - Props placed ≥ 7 m from track centerline (driving clearance)
//   - Heights sampled from heightAt() so objects sit flush on terrain
//   - Palette: warm concrete greys, dark char, sand — no saturated tones
//   - The checkpoint zone (|z| < 28) is kept clear for the set piece

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { trackCenterX, heightAt, CHUNK_LENGTH } from "./terrainFn";

// ── Palette ────────────────────────────────────────────────────────────────
const COL_CONCRETE   = new THREE.Color("#857b71");
const COL_CONCRETE_D = new THREE.Color("#635c54");
const COL_RUBBLE_A   = new THREE.Color("#9e8e7c");
const COL_RUBBLE_B   = new THREE.Color("#7a6f62");
const COL_CHAR       = new THREE.Color("#3e3836");
const COL_TIRE       = new THREE.Color("#2a2826");

// ── Seeded pseudo-random ───────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Box factory — transformed, vertex-coloured, ready to merge ─────────────
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _mat = new THREE.Matrix4();
const _one = new THREE.Vector3(1, 1, 1);
const _pos = new THREE.Vector3();

function colouredBox(
  out: THREE.BufferGeometry[],
  color: THREE.Color,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  rx = 0, ry = 0, rz = 0,
): void {
  const g = new THREE.BoxGeometry(w, h, d);
  const count = g.attributes.position.count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colours[i * 3]     = color.r;
    colours[i * 3 + 1] = color.g;
    colours[i * 3 + 2] = color.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  _euler.set(rx, ry, rz);
  _quat.setFromEuler(_euler);
  _pos.set(x, y, z);
  _mat.compose(_pos, _quat, _one);
  g.applyMatrix4(_mat);
  out.push(g);
}

// ── Prop builders ──────────────────────────────────────────────────────────
function wallSlab(
  out: THREE.BufferGeometry[], rng: () => number,
  cx: number, z: number, side: number,
): void {
  const dist = 8 + rng() * 22;        // 8–30 m from track
  const x    = cx + side * dist;
  const w    = 0.3 + rng() * 0.35;    // wall thickness
  const h    = 2.2 + rng() * 2.8;     // height 2.2–5 m
  const l    = 3.5 + rng() * 5.5;     // wall length
  const rotY = (rng() - 0.5) * 0.4;
  const dark = rng() > 0.6;

  colouredBox(out, dark ? COL_CONCRETE_D : COL_CONCRETE,
    l, h, w, x, heightAt(x, z) + h / 2, z, 0, rotY, 0);

  // A secondary lower slab adjacent — collapsed section
  if (rng() > 0.55) {
    const ox = x + (rng() - 0.5) * 4;
    const oz = z + (rng() - 0.5) * 3;
    const oh = 0.8 + rng() * 1.4;
    colouredBox(out, COL_CONCRETE_D,
      1.5 + rng() * 3, oh, w,
      ox, heightAt(ox, oz) + oh / 2, oz,
      0, rotY + (rng() - 0.5) * 0.6, 0);
  }
}

function rubblePile(
  out: THREE.BufferGeometry[], rng: () => number,
  cx: number, z: number, side: number,
): void {
  const dist  = 7 + rng() * 16;       // 7–23 m from track
  const px    = cx + side * dist;
  const count = 3 + Math.floor(rng() * 4);
  for (let c = 0; c < count; c++) {
    const bx = px + (rng() - 0.5) * 3;
    const bz = z  + (rng() - 0.5) * 3;
    const sy = 0.12 + rng() * 0.4;
    colouredBox(out, rng() > 0.5 ? COL_RUBBLE_A : COL_RUBBLE_B,
      0.3 + rng() * 0.9, sy, 0.3 + rng() * 0.9,
      bx, heightAt(bx, bz) + sy / 2, bz,
      (rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.5);
  }
}

function burntHusk(
  out: THREE.BufferGeometry[], rng: () => number,
  cx: number, z: number, side: number,
): void {
  const dist = 12 + rng() * 20;       // 12–32 m from track
  const x    = cx + side * dist;
  const rotY = rng() * Math.PI * 2;
  const gy   = heightAt(x, z);
  const cos  = Math.cos(rotY), sin = Math.sin(rotY);
  // Local-to-world for husk parts (manual group transform)
  const part = (color: THREE.Color, w: number, h: number, d: number, lx: number, ly: number, lz: number) =>
    colouredBox(out, color, w, h, d,
      x + lx * cos + lz * sin, gy + ly, z - lx * sin + lz * cos,
      0, rotY, 0);

  part(COL_CHAR, 2.8, 0.7, 1.4, 0, 0.45, 0);        // body
  part(COL_CHAR, 1.0, 0.6, 1.25, 0.5, 0.95, 0);     // cab stub
  part(COL_TIRE, 0.4, 0.4, 0.18, -1.0, 0.2, -0.55); // wheels, collapsed flat
  part(COL_TIRE, 0.4, 0.4, 0.18,  1.0, 0.2, -0.55);
  part(COL_TIRE, 0.4, 0.4, 0.18, -1.0, 0.2,  0.55);
  part(COL_TIRE, 0.4, 0.4, 0.18,  1.0, 0.2,  0.55);
}

// ── Public API ─────────────────────────────────────────────────────────────
/**
 * Builds the merged scenery geometry for one chunk, or null if the chunk
 * has no props. Caller owns the geometry (dispose on unmount — R3F does
 * this automatically for JSX-attached geometry).
 */
export function buildSceneryGeometry(chunkIndex: number): THREE.BufferGeometry | null {
  const out: THREE.BufferGeometry[] = [];
  // Seed mixes a fixed salt with the chunk index — deterministic per chunk.
  const rng = lcg(0xf13e40 ^ Math.imul(chunkIndex + 101, 2654435761));

  const z0 = chunkIndex * CHUNK_LENGTH;
  for (let z = z0 + 6; z < z0 + CHUNK_LENGTH; z += 12) {
    // Keep the checkpoint zone clear — the set piece owns it.
    if (Math.abs(z) < 28) continue;

    const side = rng() > 0.5 ? 1 : -1;
    const type = rng();
    const cx = trackCenterX(z);

    if (type < 0.45)      wallSlab(out, rng, cx, z, side);
    else if (type < 0.80) rubblePile(out, rng, cx, z, side);
    else                  burntHusk(out, rng, cx, z, side);
  }

  if (out.length === 0) return null;
  const merged = mergeGeometries(out, false);
  for (const g of out) g.dispose();
  return merged;
}
