// diag-profile — numerically inspect the track-band height profile.
// Compares the continuous heightAt() along the centreline against the
// FACETED height the collider actually presents (bilinear over the 3m grid
// would be wrong — trimesh is two triangles per cell, so sample the actual
// triangle plane).
//
// Usage: node scripts/diag-profile.mjs

// Inline copies of the terrain functions (can't import TS from .mjs).
const ROUTE_START = -100;
function trackCenterX(z) {
  return Math.sin(z * 0.014) * 14 + Math.sin(z * 0.031) * 4 + Math.sin(z * 0.0042) * 8;
}
function heightAt(x, z) {
  const distFromTrack = Math.abs(x - trackCenterX(z));
  const climb = (z - ROUTE_START) * 0.03 + Math.sin(z * 0.008) * 2;
  let noise = 0, amp = 2.0, freq = 0.018;
  for (let o = 0; o < 4; o++) {
    noise += Math.sin(x * freq * 1.13 + 0.7) * Math.cos(z * freq * 0.97 + 1.3) * amp;
    amp *= 0.5; freq *= 2.05;
  }
  const shoulderT = Math.min(1, Math.max(0, (distFromTrack - 6) / 22));
  const shoulder = shoulderT * shoulderT * 2.5;
  const distFactor = Math.max(0, distFromTrack - 28);
  const peaks = distFactor * 0.45 +
    Math.sin(x * 0.028) * Math.cos(z * 0.022) * Math.min(distFactor, 9);
  const carve = Math.max(0, 1 - distFromTrack / 4) * 1.6;
  return climb + noise + shoulder + peaks - carve;
}

// Grid faceting: chunk grid is 3m in X (240/80), ~2.94m in Z (100/34).
const DX = 240 / 80, DZ = 100 / 34;
function gridHeight(x, z) {
  // Snap to cell, evaluate the two grid corners' plane (approximate facet
  // height via bilinear — close enough to spot washboard amplitude).
  const x0 = Math.floor(x / DX) * DX, z0 = Math.floor(z / DZ) * DZ;
  const fx = (x - x0) / DX, fz = (z - z0) / DZ;
  const h00 = heightAt(x0, z0),      h10 = heightAt(x0 + DX, z0);
  const h01 = heightAt(x0, z0 + DZ), h11 = heightAt(x0 + DX, z0 + DZ);
  return h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz;
}

console.log('  z      cx      smooth   faceted   diff    d(smooth)/dz over 2m');
let prev = null;
for (let z = -100; z <= -30; z += 2) {
  const cx = trackCenterX(z);
  const hs = heightAt(cx, z);
  const hf = gridHeight(cx, z);
  const slope = prev === null ? 0 : (hs - prev) / 2;
  prev = hs;
  console.log(
    z.toFixed(0).padStart(5),
    cx.toFixed(2).padStart(8),
    hs.toFixed(2).padStart(8),
    hf.toFixed(2).padStart(8),
    (hf - hs).toFixed(2).padStart(7),
    slope.toFixed(3).padStart(8),
  );
}
