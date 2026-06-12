// SunLight — the dawn sun, with a shadow camera that follows the truck.
//
// A static directional light's shadow frustum only covers a fixed world box;
// on the 800m route the truck would drive out of it around z≈200 and every
// shadow would silently vanish. This component keeps the light at a fixed
// OFFSET from the truck (so the light *direction* never changes — it's the
// sun) and drags the shadow target along, so the ±110m shadow box always
// surrounds the player.
//
// Light direction matches the Sky sunPosition in World.tsx: east-northeast,
// low angle — warm grazing dawn light, perpendicular to the route so the
// flat-shaded terrain reads (see LESSONS.md 2026-05-16 on sun direction).

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DirectionalLight, Object3D, Vector3 } from "three";
import { truckRef } from "./truckRef";
import { SPAWN_X, SPAWN_Y_GROUND, SPAWN_Z } from "./terrainFn";

// Sun offset from the truck — same direction as the original fixed light
// at [100, 40, 20] so the look is unchanged.
const SUN_OFFSET = new Vector3(100, 40, 20);

const _pos = new Vector3();

export default function SunLight() {
  const light  = useRef<DirectionalLight>(null);
  const target = useRef<Object3D>(null);

  useFrame(() => {
    const l = light.current;
    const t = target.current;
    if (!l || !t) return;

    // Wire the target once both refs exist — a JSX prop would capture null
    // on first render and never update (no re-render happens here).
    if (l.target !== t) l.target = t;

    const rb = truckRef.current;
    if (!rb) return;

    const tp = rb.translation();
    _pos.set(tp.x, tp.y, tp.z);

    l.position.copy(_pos).add(SUN_OFFSET);
    t.position.copy(_pos);
    t.updateMatrixWorld();
  });

  return (
    <>
      <directionalLight
        ref={light}
        position={[SPAWN_X + SUN_OFFSET.x, SPAWN_Y_GROUND + SUN_OFFSET.y, SPAWN_Z + SUN_OFFSET.z]}
        intensity={2.5}
        color="#ffb86a"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
      />
      <object3D ref={target} position={[SPAWN_X, SPAWN_Y_GROUND, SPAWN_Z]} />
    </>
  );
}
