// Unit tests — terrainFn.ts
//
// Pure functions with no browser/DOM dependency — run in Node.js via Vitest.
// These catch silent regressions when terrain constants or formulae change.
// A failing test here means something physical changed (spawn height, terrain
// shape, track curve, chunk maths) that the camera, physics, or scenery all
// depend on.

import { describe, it, expect } from 'vitest';
import {
  heightAt,
  trackCenterX,
  ROUTE_START,
  ROUTE_END,
  CHUNK_LENGTH,
  CHUNK_MIN_INDEX,
  CHUNK_MAX_INDEX,
  CHUNK_AHEAD,
  CHUNK_BEHIND,
  chunkIndexAt,
  activeChunkRange,
  SPAWN_X,
  SPAWN_Y,
  SPAWN_Y_GROUND,
  SPAWN_Z,
} from '../../src/scene/terrainFn';

describe('terrainFn — route constants', () => {
  it('route runs -100 → +700 (800m)', () => {
    expect(ROUTE_START).toBe(-100);
    expect(ROUTE_END).toBe(700);
  });

  it('SPAWN_Z is the route start', () => {
    expect(SPAWN_Z).toBe(ROUTE_START);
  });

  it('SPAWN_Y gives the truck enough clearance for the raycast vehicle to settle', () => {
    // With the RaycastVehicleController, the chassis sits above the wheels
    // and the suspension has ~0.42m of rest travel. Spawn clearance 1.8m so
    // wheels hover ~0.6m above ground and the suspension settles naturally.
    const clearance = SPAWN_Y - SPAWN_Y_GROUND;
    expect(clearance).toBeCloseTo(1.8, 2);
  });
});

describe('terrainFn — chunk maths', () => {
  it('chunkIndexAt maps z to 100m slabs', () => {
    expect(chunkIndexAt(0)).toBe(0);
    expect(chunkIndexAt(99.9)).toBe(0);
    expect(chunkIndexAt(100)).toBe(1);
    expect(chunkIndexAt(-1)).toBe(-1);
    expect(chunkIndexAt(-100)).toBe(-1);
  });

  it('chunk extent covers the whole route plus margins', () => {
    expect(CHUNK_MIN_INDEX * CHUNK_LENGTH).toBeLessThanOrEqual(ROUTE_START - 100);
    expect((CHUNK_MAX_INDEX + 1) * CHUNK_LENGTH).toBeGreaterThanOrEqual(ROUTE_END + 200);
  });

  it('active range at spawn includes the chunk under the truck', () => {
    const [min, max] = activeChunkRange(SPAWN_Z);
    expect(min).toBeLessThanOrEqual(chunkIndexAt(SPAWN_Z));
    expect(max).toBeGreaterThanOrEqual(chunkIndexAt(SPAWN_Z));
  });

  it('active range never exceeds the world extent', () => {
    for (const z of [-500, ROUTE_START, 0, 350, ROUTE_END, 2000]) {
      const [min, max] = activeChunkRange(z);
      expect(min).toBeGreaterThanOrEqual(CHUNK_MIN_INDEX);
      expect(max).toBeLessThanOrEqual(CHUNK_MAX_INDEX);
      expect(min).toBeLessThanOrEqual(max);
    }
  });

  it('streaming window sits inside the fog (ahead ≤ 380m far plane)', () => {
    expect(CHUNK_AHEAD).toBeLessThanOrEqual(380);
    expect(CHUNK_BEHIND).toBeGreaterThanOrEqual(100); // never despawn under the truck
  });
});

describe('terrainFn — trackCenterX', () => {
  it('returns a number for any z', () => {
    for (const z of [ROUTE_START, -50, 0, 200, 500, ROUTE_END]) {
      expect(typeof trackCenterX(z)).toBe('number');
      expect(isNaN(trackCenterX(z))).toBe(false);
    }
  });

  it('stays within ±30m of world centre across the full run', () => {
    for (let z = ROUTE_START; z <= ROUTE_END; z += 5) {
      const cx = trackCenterX(z);
      expect(Math.abs(cx)).toBeLessThan(30);
    }
  });

  it('heading deviation stays gentle (drivable without hard steering)', () => {
    // Max |dx/dz| ≈ 0.36 → ~20°. If a new sine component pushes this higher
    // the no-steer funnel test (e2e racer) will start failing.
    for (let z = ROUTE_START; z <= ROUTE_END; z += 2) {
      const slope = Math.abs(trackCenterX(z + 1) - trackCenterX(z - 1)) / 2;
      expect(slope).toBeLessThan(0.4);
    }
  });
});

describe('terrainFn — heightAt', () => {
  it('returns a finite number everywhere on the active corridor', () => {
    for (let z = ROUTE_START - 200; z <= ROUTE_END + 250; z += 50) {
      for (let x = -120; x <= 120; x += 20) {
        expect(isFinite(heightAt(x, z))).toBe(true);
      }
    }
  });

  it('terrain climbs south-to-north across the run', () => {
    const hSouth = heightAt(trackCenterX(ROUTE_START), ROUTE_START);
    const hNorth = heightAt(trackCenterX(ROUTE_END), ROUTE_END);
    expect(hNorth).toBeGreaterThan(hSouth + 10); // ≥10m total climb
  });

  it('sustained track grade stays under 9% (engine stall budget)', () => {
    // Measured over 40m windows — short noise bumps are fine (momentum
    // carries the truck through them); sustained grade is what stalls it.
    // The pre-chunking terrain shipped with >10% worst windows and the
    // truck handled them; 9% keeps headroom while catching runaway redesigns.
    for (let z = ROUTE_START; z <= ROUTE_END - 40; z += 10) {
      const h0 = heightAt(trackCenterX(z), z);
      const h1 = heightAt(trackCenterX(z + 40), z + 40);
      expect(Math.abs(h1 - h0) / 40).toBeLessThan(0.09);
    }
  });

  it('track valley is lower than the 22m shoulder at the same z', () => {
    for (let z = -80; z <= ROUTE_END - 20; z += 40) {
      const cx = trackCenterX(z);
      const onTrack  = heightAt(cx, z);
      const offTrack = heightAt(cx + 22, z);
      expect(onTrack).toBeLessThanOrEqual(offTrack + 0.5);
    }
  });

  it('spawn ground height is the baseline for SPAWN_Y_GROUND', () => {
    expect(heightAt(SPAWN_X, SPAWN_Z)).toBeCloseTo(SPAWN_Y_GROUND, 4);
  });

  it('terrain has micro-variation (not perfectly flat) off-track', () => {
    const heights = new Set<string>();
    for (let x = -100; x <= 100; x += 10) {
      heights.add(heightAt(x, 50).toFixed(3));
    }
    expect(heights.size).toBeGreaterThan(5);
  });
});

describe('terrainFn — spawn position', () => {
  it('SPAWN_X matches trackCenterX at SPAWN_Z', () => {
    expect(SPAWN_X).toBeCloseTo(trackCenterX(SPAWN_Z), 5);
  });

  it('SPAWN_Y is above ground (no starting-underground bug)', () => {
    expect(SPAWN_Y).toBeGreaterThan(SPAWN_Y_GROUND);
  });

  it('SPAWN_Y is not absurdly high (no sky-spawn bug)', () => {
    expect(SPAWN_Y - SPAWN_Y_GROUND).toBeLessThan(5);
  });
});
