// terrain — pure functions describing the world's shape.
//
// Heights are sampled from a function, not stored in a grid. This keeps the
// implementation chunk-streaming-ready: a future ChunkManager can sample any
// (x, z) on demand without rebuilding a single big mesh.
//
// The corridor geography:
//   ─ A track centerline curves south-to-north on a swept sine
//   ─ The track sits in a carved valley (lower than surrounding terrain)
//   ─ Surrounding terrain rises into peaks far from the track
//   ─ Multi-octave noise gives natural variation without ridged-noise cliffs
//   ─ A gradual climb from south to north so the run feels uphill
//
// Tuning bias: avoid harsh slopes in the track band (truck doesn't have a
// real vehicle controller yet — extreme inclines bug out the cuboid physics).
// Outside the track band, rougher is fine and reads better at distance.

export const TERRAIN_SIZE  = 240;   // metres, square footprint
export const TERRAIN_VERTS = 96;    // grid resolution per side
export const TERRAIN_CELLS = TERRAIN_VERTS - 1;

/**
 * Track centerline X as a function of Z. The track curves through the world
 * with two superposed sine components — the slow component is the broad
 * arc of the route, the fast component adds switchback feel.
 */
export function trackCenterX(z: number): number {
  return Math.sin(z * 0.014) * 14 + Math.sin(z * 0.031) * 4;
}

/**
 * Height at (x, z) in world coordinates. Pure function — same input always
 * returns the same output. Safe to call from any component, render thread,
 * or worker.
 */
export function heightAt(x: number, z: number): number {
  // Distance from the carved track centerline
  const distFromTrack = Math.abs(x - trackCenterX(z));

  // South-to-north climb. At z = -TERRAIN_SIZE/2 the base elevation is 0m,
  // at z = +TERRAIN_SIZE/2 it's ~18m. Linear so the truck doesn't fight slope.
  const climb = ((z + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * 18;

  // Multi-octave continuous noise. Sin/cos product is cheap and continuous
  // (no seams), enough variation for a 240m-square map. Real Perlin would be
  // overkill here.
  let noise = 0;
  let amp = 2.0;
  let freq = 0.018;
  for (let o = 0; o < 4; o++) {
    noise += Math.sin(x * freq * 1.13 + 0.7) * Math.cos(z * freq * 0.97 + 1.3) * amp;
    amp *= 0.5;
    freq *= 2.05;
  }

  // Distant terrain rises into peaks. The factor scales with how far from
  // the track we are; near the track the contribution is zero.
  const distFactor = Math.max(0, distFromTrack - 28);
  const peaks =
    distFactor * 0.45 +
    Math.sin(x * 0.028) * Math.cos(z * 0.022) * Math.min(distFactor, 9);

  // Carve the track lower than surroundings — the valley the route runs in.
  // Narrowed to 4m (was 6m) so the truck can't stray far without feeling the
  // rise. The centre of the valley still has micro-bumps from the noise octaves
  // above — the carve smooths the gross shape, not the surface texture.
  const carve = Math.max(0, 1 - distFromTrack / 4) * 1.6;

  return climb + noise + peaks - carve;
}

/** Sensible spawn point for the truck — on the track at the south edge. */
export const SPAWN_Z = -100;
export const SPAWN_X = trackCenterX(SPAWN_Z);
export const SPAWN_Y_GROUND = heightAt(SPAWN_X, SPAWN_Z);
/** y for the truck's RigidBody position — chassis-center height above ground.
 *  Cuboid collider half-height is 0.85. At -18 gravity (2× real) the truck
 *  falls faster on the first frame, so clearance raised from +1.5 to +3.0 to
 *  prevent tunneling through the trimesh on spawn. CCD is also enabled on the
 *  RigidBody as a second defence layer (Truck.tsx). */
export const SPAWN_Y = SPAWN_Y_GROUND + 3.0;
