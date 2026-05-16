// Unit tests — terrainFn.ts
//
// Pure functions with no browser/DOM dependency — run in Node.js via Vitest.
// These catch silent regressions when terrain constants or formulae change.
// A failing test here means something physical changed (spawn height, terrain
// shape, track curve) that the camera, physics, or scenery all depend on.

import { describe, it, expect } from 'vitest';
import {
  heightAt,
  trackCenterX,
  TERRAIN_SIZE,
  TERRAIN_CELLS,
  TERRAIN_VERTS,
  SPAWN_X,
  SPAWN_Y,
  SPAWN_Y_GROUND,
  SPAWN_Z,
} from '../../src/scene/terrainFn';

describe('terrainFn — constants', () => {
  it('TERRAIN_SIZE is 240m', () => {
    expect(TERRAIN_SIZE).toBe(240);
  });

  it('TERRAIN_VERTS is TERRAIN_CELLS + 1', () => {
    expect(TERRAIN_VERTS).toBe(TERRAIN_CELLS + 1);
  });

  it('SPAWN_Z is -100', () => {
    expect(SPAWN_Z).toBe(-100);
  });

  it('SPAWN_Y gives the truck enough clearance for the raycast vehicle to settle', () => {
    // With the RaycastVehicleController (post Bruno-Simon rewrite), the chassis
    // sits above the wheels and the suspension has ~0.42m of rest travel.
    // Spawn clearance bumped to 1.8m so wheels hover ~0.6m above ground and
    // the suspension can compress naturally on first contact.
    const clearance = SPAWN_Y - SPAWN_Y_GROUND;
    expect(clearance).toBeCloseTo(1.8, 2);
  });
});

describe('terrainFn — trackCenterX', () => {
  it('returns a number for any z', () => {
    for (const z of [-100, -50, 0, 50, 100, 120]) {
      expect(typeof trackCenterX(z)).toBe('number');
      expect(isNaN(trackCenterX(z))).toBe(false);
    }
  });

  it('stays within ±20m of world centre across the full run', () => {
    for (let z = -100; z <= 120; z += 5) {
      const cx = trackCenterX(z);
      expect(Math.abs(cx)).toBeLessThan(20);
    }
  });
});

describe('terrainFn — heightAt', () => {
  it('returns a finite number everywhere on the terrain grid', () => {
    const step = TERRAIN_SIZE / 20;
    for (let x = -TERRAIN_SIZE / 2; x <= TERRAIN_SIZE / 2; x += step) {
      for (let z = -TERRAIN_SIZE / 2; z <= TERRAIN_SIZE / 2; z += step) {
        const h = heightAt(x, z);
        expect(isFinite(h)).toBe(true);
      }
    }
  });

  it('terrain climbs south-to-north across the run', () => {
    // South spawn (z=-100) should be lower than north end (z=+120)
    const hSouth = heightAt(trackCenterX(-100), -100);
    const hNorth = heightAt(trackCenterX(120), 120);
    expect(hNorth).toBeGreaterThan(hSouth);
  });

  it('track valley is lower than 20m off-track at the same z', () => {
    for (let z = -80; z <= 100; z += 20) {
      const cx = trackCenterX(z);
      const onTrack  = heightAt(cx, z);
      const offTrack = heightAt(cx + 22, z);   // 22m off centreline — outside carve zone
      expect(onTrack).toBeLessThanOrEqual(offTrack + 0.5); // track should be at or below off-track
    }
  });

  it('spawn ground height is the baseline for SPAWN_Y_GROUND', () => {
    expect(heightAt(SPAWN_X, SPAWN_Z)).toBeCloseTo(SPAWN_Y_GROUND, 4);
  });

  it('terrain has micro-variation (not perfectly flat) off-track', () => {
    // If the noise function is broken (returns 0), all heights would be identical.
    const heights = new Set<string>();
    for (let x = -100; x <= 100; x += 10) {
      heights.add(heightAt(x, 0).toFixed(3));
    }
    expect(heights.size).toBeGreaterThan(5); // at least 5 distinct height values
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
