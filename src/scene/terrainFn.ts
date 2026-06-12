// terrain — pure functions describing the world's shape.
//
// Heights are sampled from a function, not stored in a grid. Any (x, z) can
// be sampled on demand — this is what makes chunk streaming possible: the
// ChunkManager (Terrain.tsx) materialises only the stretch of world around
// the truck, and every consumer (scenery, pedestrians, set pieces) grounds
// itself with the same heightAt() call.
//
// The corridor geography:
//   ─ A track centerline curves south-to-north on superposed sines
//   ─ The track sits in a carved valley with rising shoulders — the valley
//     profile self-centres the truck (lateral slope nudges it back to the
//     racing line without invisible walls)
//   ─ Surrounding terrain rises into peaks far from the track
//   ─ Multi-octave noise gives natural variation without ridged-noise cliffs
//   ─ A gradual climb from south to north so the run feels uphill
//
// Tuning bias: max combined grade on the track stays under ~5% so the
// raycast vehicle (ENGINE_FORCE_PEAK 1400 N, 1500 kg) never stalls uphill.

// ── Route ──────────────────────────────────────────────────────────────────
/** Truck spawn z — the south end of the run. */
export const ROUTE_START = -100;
/** Ending threshold z — crossing this ends the run (see StoryWatcher). */
export const ROUTE_END = 700;

// ── Chunks ─────────────────────────────────────────────────────────────────
// The world is materialised in 100m-long, 240m-wide slabs. Chunk i covers
// z ∈ [i*CHUNK_LENGTH, (i+1)*CHUNK_LENGTH). Resolution ~3m per cell — flat
// shading hides the coarseness and keeps 6 active chunks under 35k tris.
export const CHUNK_LENGTH = 100;   // metres along Z
export const CHUNK_WIDTH  = 240;   // metres along X
export const CHUNK_SEGS_Z = 34;    // grid cells along Z (~3m)
export const CHUNK_SEGS_X = 80;    // grid cells along X (3m)

/** World extends 2 chunks south of spawn and 3 past the ending so the
    horizon never shows void at either end of the run. */
export const CHUNK_MIN_INDEX = Math.floor((ROUTE_START - 200) / CHUNK_LENGTH); // -3
export const CHUNK_MAX_INDEX = Math.floor((ROUTE_END + 250) / CHUNK_LENGTH);   //  9

/** Streaming window relative to the truck. AHEAD sits just inside the fog
    far plane (380m) so chunk pop-in happens fully fogged. */
export const CHUNK_AHEAD  = 360;
export const CHUNK_BEHIND = 150;

export function chunkIndexAt(z: number): number {
  return Math.floor(z / CHUNK_LENGTH);
}

/** Inclusive [min, max] chunk index range that should be alive for a truck
    at the given z. Both ends clamp into the world's chunk extent, so even a
    truck driven past the edge of the world keeps a valid (edge) range. */
export function activeChunkRange(truckZ: number): [number, number] {
  const clamp = (i: number) =>
    Math.min(CHUNK_MAX_INDEX, Math.max(CHUNK_MIN_INDEX, i));
  return [
    clamp(chunkIndexAt(truckZ - CHUNK_BEHIND)),
    clamp(chunkIndexAt(truckZ + CHUNK_AHEAD)),
  ];
}

// ── Track centerline ───────────────────────────────────────────────────────
/**
 * Track centerline X as a function of Z. Three superposed sine components:
 * slow drift (the broad arc of the route), medium arc, and a fast component
 * for switchback feel. Max |x| ≈ 26m, max heading deviation ≈ 20°.
 */
export function trackCenterX(z: number): number {
  return (
    Math.sin(z * 0.014) * 14 +
    Math.sin(z * 0.031) * 4 +
    Math.sin(z * 0.0042) * 8
  );
}

// ── Height field ───────────────────────────────────────────────────────────
/**
 * Height at (x, z) in world coordinates. Pure function — same input always
 * returns the same output. Safe to call from any component, render thread,
 * or worker.
 */
export function heightAt(x: number, z: number): number {
  // Distance from the carved track centerline
  const distFromTrack = Math.abs(x - trackCenterX(z));

  // South-to-north climb: 3% base grade + a long rolling wave (±2m over
  // ~785m). Combined worst case ≈ 4.6% — well inside the truck's hill budget.
  const climb = (z - ROUTE_START) * 0.03 + Math.sin(z * 0.008) * 2;

  // Multi-octave continuous noise. Sin/cos product is cheap and continuous
  // (no seams), enough variation at this scale. Real Perlin would be overkill.
  let noise = 0;
  let amp = 2.0;
  let freq = 0.018;
  for (let o = 0; o < 4; o++) {
    noise += Math.sin(x * freq * 1.13 + 0.7) * Math.cos(z * freq * 0.97 + 1.3) * amp;
    amp *= 0.5;
    freq *= 2.05;
  }

  // GRADE THE ROAD — damp the noise inside the track band (15% at the
  // centreline, full strength from 10m out). Two reasons:
  //   1. Fiction: a road used daily is graded flat; the wilderness isn't.
  //   2. Physics: the collider is a 3m-faceted trimesh. Full-amplitude noise
  //      across the narrow carve reads as a ±0.5m washboard at facet scale —
  //      it porpoised the truck airborne at 50 km/h, beached it on crests,
  //      and could punch it through the trimesh shell (the fall-through bug
  //      caught by the smoke suite, 2026-06-12). A near-planar track band
  //      makes facet error negligible.
  const gradeT = Math.min(1, Math.max(0, (distFromTrack - 2) / 8));
  noise *= 0.15 + 0.85 * gradeT * gradeT;

  // Valley shoulder — terrain rises 2.5m between 6m and 28m off-track
  // (quadratic ease-in so the inner edge is soft). This is what makes the
  // corridor read as a road through terrain AND what self-centres a truck
  // that drifts off the line.
  const shoulderT = Math.min(1, Math.max(0, (distFromTrack - 6) / 22));
  const shoulder = shoulderT * shoulderT * 2.5;

  // Distant terrain rises into peaks. The factor scales with how far from
  // the track we are; near the track the contribution is zero.
  const distFactor = Math.max(0, distFromTrack - 28);
  const peaks =
    distFactor * 0.45 +
    Math.sin(x * 0.028) * Math.cos(z * 0.022) * Math.min(distFactor, 9);

  // Carve the track lower than surroundings — the valley floor the route
  // runs in. 4m half-width; the centre keeps micro-bumps from the noise.
  const carve = Math.max(0, 1 - distFromTrack / 4) * 1.6;

  return climb + noise + shoulder + peaks - carve;
}

// ── Spawn ──────────────────────────────────────────────────────────────────
/** Sensible spawn point for the truck — on the track at the south edge. */
export const SPAWN_Z = ROUTE_START;
export const SPAWN_X = trackCenterX(SPAWN_Z);
export const SPAWN_Y_GROUND = heightAt(SPAWN_X, SPAWN_Z);
/** y for the truck's RigidBody position — chassis-center height above ground.
 *  With the Rapier RaycastVehicleController, the chassis collider sits ABOVE
 *  the wheels (position [0, 0.45, 0] inside the RigidBody, half-height 0.45).
 *  Wheel suspension rest length is 0.42m, hub at chassis-local Y = -0.35.
 *  So the bottom of the wheels is at chassis_y + (-0.35) + (-0.42) - WHEEL_R
 *  = chassis_y - 1.19m below the rigid body origin.
 *  Spawning the body at ground + 1.8m puts the wheels ~0.6m above ground so
 *  the suspension can settle naturally on first contact. */
export const SPAWN_Y = SPAWN_Y_GROUND + 1.8;
