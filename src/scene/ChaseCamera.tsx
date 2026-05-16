// ChaseCamera — third-person follow camera. Reads truck transform each frame
// from the shared truckRef and lerps the active camera toward an offset behind
// and above the truck.
//
// Feel reference: Bruno Simon, Border Run.
//
// Improvements over v1:
//   - Speed-based FOV: widens from 60° to 74° at full speed. The world rushes
//     past when you floor it. Tightens again when you brake.
//   - Landing shake: detects vy sign flip + magnitude to trigger a camera jolt
//     when the truck bottoms out on terrain. Separate from beat shake.
//   - Tighter FOLLOW_LERP (6.5 vs 4.5): camera is more glued to the truck,
//     matching the responsive feel of Bruno Simon's camera.
//   - Camera offset is rotated by full truck quaternion (not just yaw), so the
//     camera tilts when the truck pitches over a crest.

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Quaternion, PerspectiveCamera } from "three";
import { truckRef } from "./truckRef";
import { shake } from "./shakeRef";

// Camera sits 11m behind the truck, 4m above.
// Look target is 7m ahead, 1.5m above ground level — keeps terrain in shot
// while showing sky at top. Reference: Over the Hill, Bruno Simon.
const OFFSET_LOCAL  = new Vector3(0, 4.0, 11);
const LOOK_LOCAL    = new Vector3(0, -1.5, -7);
const FOLLOW_LERP   = 6.5;   // pos lerp rate (was 4.5 — tighter = more glued)
// LOOK_LERP reserved — lookAt() applied directly each frame is smooth enough
// const LOOK_LERP     = 7.0;

const FOV_BASE      = 60;    // degrees at rest
const FOV_MAX       = 74;    // degrees at MAX_SPEED
const FOV_MAX_SPEED = 11;    // m/s at which FOV peaks
const FOV_LERP      = 3.5;   // how quickly FOV tracks speed changes

// Landing shake: when vy (downward velocity) drops by more than this between
// frames, trigger a camera jolt. 4 m/s delta is a noticeable bump on terrain.
const LAND_VY_THRESHOLD = 3.5;
const LAND_SHAKE_MAG    = 0.18;  // slightly bigger than beat shake (0.12)
const LAND_SHAKE_DUR    = 0.25;  // seconds

// Reused work vectors — avoid GC pressure each frame.
const _desiredPos  = new Vector3();
const _truckPos    = new Vector3();
const _truckQuat   = new Quaternion();
const _lookTarget  = new Vector3();

export default function ChaseCamera() {
  const { camera } = useThree();
  const prevVy    = useRef(0);
  const landShake = useRef(0);   // countdown timer for landing shake

  useFrame((_, dt) => {
    const rb = truckRef.current;
    if (!rb) return;

    // ── Truck transform ──────────────────────────────────────────────────
    const tp = rb.translation();
    const tq = rb.rotation();
    _truckPos.set(tp.x, tp.y, tp.z);
    _truckQuat.set(tq.x, tq.y, tq.z, tq.w);

    // ── Landing shake detection ──────────────────────────────────────────
    // Detect when vy goes from negative (falling) to near-zero (landed).
    // The larger the vy drop, the harder the landing.
    const vy = rb.linvel().y;
    if (prevVy.current < -LAND_VY_THRESHOLD && vy > prevVy.current) {
      // Just landed — trigger landing shake proportional to impact
      const impact = Math.min(1, -prevVy.current / 8);
      landShake.current = LAND_SHAKE_DUR * impact;
    }
    prevVy.current = vy;

    // ── Camera position: offset rotated by FULL truck quaternion ─────────
    // (includes pitch over crests, not just yaw). Camera tilts with the truck.
    _desiredPos.copy(OFFSET_LOCAL).applyQuaternion(_truckQuat).add(_truckPos);

    const posK = 1 - Math.exp(-FOLLOW_LERP * dt);
    camera.position.lerp(_desiredPos, posK);

    // ── Look target ──────────────────────────────────────────────────────
    _lookTarget.copy(LOOK_LOCAL).applyQuaternion(_truckQuat).add(_truckPos);
    camera.lookAt(_lookTarget);

    // ── Speed-based FOV ──────────────────────────────────────────────────
    // Measure planar speed (XZ plane) — matches what we show in HUD.
    const lv = rb.linvel();
    const planarSpeed = Math.sqrt(lv.x * lv.x + lv.z * lv.z);
    const fovTarget = FOV_BASE + Math.min(1, planarSpeed / FOV_MAX_SPEED) * (FOV_MAX - FOV_BASE);
    const cam = camera as PerspectiveCamera;
    cam.fov += (fovTarget - cam.fov) * Math.min(1, FOV_LERP * dt);
    cam.updateProjectionMatrix();

    // ── Beat shake (story events) ────────────────────────────────────────
    if (shake.countdown > 0) {
      shake.countdown = Math.max(0, shake.countdown - dt);
      const mag = 0.12 * (shake.countdown / 0.38);
      camera.position.x += (Math.random() - 0.5) * mag;
      camera.position.y += (Math.random() - 0.5) * mag * 0.4;
    }

    // ── Landing shake ────────────────────────────────────────────────────
    if (landShake.current > 0) {
      landShake.current = Math.max(0, landShake.current - dt);
      const mag = LAND_SHAKE_MAG * (landShake.current / LAND_SHAKE_DUR);
      camera.position.x += (Math.random() - 0.5) * mag;
      camera.position.y += (Math.random() - 0.5) * mag * 0.6;
    }
  });

  return null;
}
