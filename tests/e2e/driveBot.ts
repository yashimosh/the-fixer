// driveBot — a path-following driver for e2e tests.
//
// Holds throttle and steers like a (crude) human: it controls HEADING, not
// position. Desired heading = road tangent + a pure-pursuit centering term;
// the steer keys pulse only while the heading error is outside a deadband.
// Big corrections lift off the throttle (power-on oversteer spins the light
// arcade body on dirt — see Truck.tsx tuning note).
//
// Uses the __fixerTruckPos exposure (x, z, trackX, trackTanX) and the
// __fixerKeys input hook. Heading is estimated from successive positions in
// this node-side loop — no page instrumentation needed.
//
// Steering sign: k.left yaws the truck toward +X when moving forward (+Z),
// and heading is measured as atan2(dx, dz) — so positive heading error
// (need more +X) → press left.

/* eslint-disable @typescript-eslint/no-explicit-any */

interface BotResult {
  endedPhase: string;
  finalZ: number;
  timedOut: boolean;
}

const TICK_MS = 140;
const CENTERING_GAIN = 0.06;  // rad of desired-heading per metre off centre
const DEADBAND = 0.10;        // rad — no steering inside this
const BIG_ERROR = 0.5;        // rad — lift off the throttle beyond this

/**
 * Drives until the run ends (phase "ended"), the truck passes endZ, or
 * maxMs elapses.
 */
export async function driveBot(
  page: any,
  { endZ = 705, maxMs = 170_000 }: { endZ?: number; maxMs?: number } = {},
): Promise<BotResult> {
  const start = Date.now();
  let prev: { x: number; z: number } | null = null;
  let heading = 0; // spawn faces +Z = heading 0

  for (;;) {
    // Read state first (no input change), then decide, then write input.
    const pos = await page.evaluate(() => {
      const w = window as any;
      return {
        pos: w.__fixerTruckPos ?? null,
        phase: w.__fixer_store?.useGame?.getState()?.phase ?? 'unknown',
      };
    });

    const p = pos.pos;
    const done = pos.phase === 'ended' || (p?.z ?? -999) >= endZ;
    const timedOut = Date.now() - start > maxMs;

    if (done || timedOut) {
      await page.evaluate(() => {
        const keys = (window as any).__fixerKeys;
        if (keys) { keys.fwd = false; keys.left = false; keys.right = false; }
      });
      return { endedPhase: pos.phase, finalZ: p?.z ?? -999, timedOut: !done && timedOut };
    }

    if (p && pos.phase === 'running') {
      // Update heading estimate from movement (≥0.3m to beat the rounding).
      // A jump >5m in one tick is the recovery net teleporting the truck
      // back onto the road facing +Z — reset the estimate to match.
      if (prev) {
        const dx = p.x - prev.x;
        const dz = p.z - prev.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 25) heading = 0;
        else if (d2 > 0.09) heading = Math.atan2(dx, dz);
      }
      prev = { x: p.x, z: p.z };

      // Desired heading: road tangent + centering toward the line.
      const centering = Math.max(-0.5, Math.min(0.5, (p.trackX - p.x) * CENTERING_GAIN));
      const desired = Math.atan2((p.trackTanX ?? 0) + centering, 1);
      let err = desired - heading;
      while (err > Math.PI) err -= 2 * Math.PI;
      while (err < -Math.PI) err += 2 * Math.PI;

      const steer = err > DEADBAND ? 1 : err < -DEADBAND ? -1 : 0;
      // Lift-off only AT SPEED — at low speed the truck needs throttle to
      // move at all (heading can only converge through motion).
      const bigCorrection = Math.abs(err) > BIG_ERROR && (p.kmh ?? 0) > 22;

      await page.evaluate(
        (a: { steer: number; lift: boolean }) => {
          const keys = (window as any).__fixerKeys;
          if (!keys) return;
          keys.fwd = !a.lift;
          keys.back = false;
          keys.brake = false;
          keys.left = a.steer > 0;
          keys.right = a.steer < 0;
        },
        { steer, lift: bigCorrection },
      );
    }

    await page.waitForTimeout(TICK_MS);
  }
}
