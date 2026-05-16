// ChaseCamera — third-person follow camera. Reads truck transform each frame
// from the shared truckRef and lerps the active camera toward an offset behind
// and above the truck.
//
// R3F's default camera is what gets controlled here (the one configured on
// <Canvas camera={...} />). useThree gives us the live camera reference.

import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Quaternion } from "three";
import { truckRef } from "./truckRef";
import { shake } from "./shakeRef";

// Both offsets are in truck-LOCAL space. OFFSET_LOCAL applied via quaternion
// gives camera position; LOOK_LOCAL applied via quaternion gives look target.
// Truck local axes after spawn rotation (π around Y):
//   local -Z = world +Z = forward (truck drives in world +Z)
//   local +Z = world -Z = backward (where the camera sits)
//   local +Y = world +Y = up
// Camera sits 11m behind the truck, 3.5m above its centre.
// Look target is 8m ahead, 2m BELOW truck centre — this points at the
// terrain surface ahead of the truck so the terrain fills most of the frame
// with sky showing as a strip at the top. Reference: Over the Hill, Bruno Simon.
const OFFSET_LOCAL = new Vector3(0, 3.5, 11);
const LOOK_LOCAL   = new Vector3(0, -2.0, -8);
const FOLLOW_LERP  = 4.5;
const LOOK_LERP    = 6.0;

// Reused work vectors to avoid GC pressure each frame.
const _desiredPos = new Vector3();
const _truckPos   = new Vector3();
const _truckQuat  = new Quaternion();
const _lookTarget = new Vector3();
const _camLook    = new Vector3();

export default function ChaseCamera() {
  const { camera } = useThree();

  useFrame((_, dt) => {
    const rb = truckRef.current;
    if (!rb) return;

    // Truck transform from physics
    const tp = rb.translation();
    const tq = rb.rotation();
    _truckPos.set(tp.x, tp.y, tp.z);
    _truckQuat.set(tq.x, tq.y, tq.z, tq.w);

    // Desired camera position: truck position + (offset rotated by truck yaw)
    _desiredPos.copy(OFFSET_LOCAL).applyQuaternion(_truckQuat).add(_truckPos);

    // Lerp camera toward desired position. Smoothing factor 1 - exp(-k*dt)
    // is frame-rate independent (works the same at 30fps or 144fps).
    const posK = 1 - Math.exp(-FOLLOW_LERP * dt);
    camera.position.lerp(_desiredPos, posK);

    // Look target: truck position + LOOK_LOCAL rotated by truck yaw.
    // Points 10m ahead of the truck so the driver sees what's coming.
    _lookTarget.copy(LOOK_LOCAL).applyQuaternion(_truckQuat).add(_truckPos);
    _camLook.copy(_lookTarget);
    const lookK = 1 - Math.exp(-LOOK_LERP * dt);
    // Decompose camera's current forward direction to estimate where it
    // currently looks, then lerp to the new target. Simpler: just look at
    // the lerped target directly each frame; it's smooth enough.
    camera.lookAt(_lookTarget);

    // ── Beat shake — small world-space jolt when a story beat fires ────
    if (shake.countdown > 0) {
      shake.countdown = Math.max(0, shake.countdown - dt);
      const mag = 0.12 * (shake.countdown / 0.38); // fades as countdown falls
      camera.position.x += (Math.random() - 0.5) * mag;
      camera.position.y += (Math.random() - 0.5) * mag * 0.4;
    }

    void _camLook;
    void lookK;
  });

  return null;
}
