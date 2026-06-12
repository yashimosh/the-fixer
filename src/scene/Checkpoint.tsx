// Checkpoint — the physical anchor for the first cargo-risk beat.
//
// "The checkpoint has been here three weeks. The soldier waves you through
// with his cigarette. He knows the truck."
//
// Rule 5: the world tells the story. The beat fires at z=-25; this set piece
// sits at z≈0 so the text and the place coincide. The barrier is RAISED
// (the soldier waves Sor through — nobody stops). The sandbag clusters pinch
// the track into a soft chicane: the natural move is to slow down, which is
// exactly what the cargo-risk speed check rewards. Mechanics and fiction
// pointing the same way, no tutorial text.
//
// Collision design: sandbag clusters and the hut have fixed colliders but
// sit ≥4.5m off the centreline — a driver (or the e2e racer bot) holding a
// straight line never clips them. The two oil drums are DYNAMIC bodies near
// the road edge: clipping one knocks it flying (Bruno Simon register), it
// never blocks the truck.
//
// No flags, no insignia — Rule 4. A generic standing figure by the hut.

import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { trackCenterX, heightAt } from "./terrainFn";

// ── Palette — matches sceneryFn's warm concrete register ──────────────────
const COL_HUT      = "#8a7f6d";   // breeze-block hut
const COL_ROOF     = "#5e564b";
const COL_SANDBAG  = "#9a8a68";   // sun-bleached bags
const COL_SANDBAG2 = "#857754";
const COL_POLE     = "#4a4642";
const COL_ARM      = "#d8d2c4";   // pale barrier arm
const COL_ARM_BAND = "#a03428";   // faded red bands
const COL_DRUM     = "#5a6258";   // olive drum
const COL_DRUM2    = "#7a4a32";   // rust drum
const COL_COAT     = "#4a4a38";   // soldier's olive jacket
const COL_PANTS    = "#2a2620";
const COL_SKIN     = "#c89970";

const CP_Z = 0;                          // set-piece anchor z
const CX   = trackCenterX(CP_Z);         // track centre at the checkpoint

/** Ground a prop at (x, z) — world y for its base. */
const gy = (x: number, z: number) => heightAt(x, z);

// ── Sandbag cluster — two staggered layers of bags + one fixed collider ───
function SandbagCluster({ x, z, rotY }: { x: number; z: number; rotY: number }) {
  const y = gy(x, z);
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.95, 0.42, 0.6]} position={[0, 0.42, 0]} />
      </RigidBody>
      {/* bottom layer */}
      <mesh castShadow position={[-0.55, 0.18, 0]}>
        <boxGeometry args={[0.75, 0.36, 1.1]} />
        <meshStandardMaterial color={COL_SANDBAG} roughness={1} flatShading />
      </mesh>
      <mesh castShadow position={[0.35, 0.18, 0.08]}>
        <boxGeometry args={[0.8, 0.36, 1.0]} />
        <meshStandardMaterial color={COL_SANDBAG2} roughness={1} flatShading />
      </mesh>
      {/* top layer, offset like real bag courses */}
      <mesh castShadow position={[-0.1, 0.52, 0.02]}>
        <boxGeometry args={[0.85, 0.32, 0.95]} />
        <meshStandardMaterial color={COL_SANDBAG} roughness={1} flatShading />
      </mesh>
      <mesh castShadow position={[-0.75, 0.5, -0.05]} rotation={[0, 0.25, 0]}>
        <boxGeometry args={[0.55, 0.3, 0.8]} />
        <meshStandardMaterial color={COL_SANDBAG2} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

// ── Oil drum — dynamic, knockable. Never blocks; flies if clipped. ────────
// Mass sized to the ARCADE truck body (~6 kg — see Truck.tsx tuning note):
// an empty drum at ~1 kg gets shoved aside playfully; a "realistic" 28 kg
// drum would bat the truck instead.
function Drum({ x, z, rust }: { x: number; z: number; rust?: boolean }) {
  return (
    <RigidBody
      colliders="hull"
      mass={1}
      position={[x, gy(x, z) + 0.5, z]}
      linearDamping={0.4}
      angularDamping={0.6}
    >
      <mesh castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.88, 12]} />
        <meshStandardMaterial
          color={rust ? COL_DRUM2 : COL_DRUM}
          roughness={0.9}
          flatShading
        />
      </mesh>
    </RigidBody>
  );
}

// ── Standing figure — the soldier by the hut. Static, generic, no insignia.
function Soldier({ x, z, facing }: { x: number; z: number; facing: number }) {
  const y = gy(x, z);
  return (
    <group position={[x, y, z]} rotation={[0, facing, 0]}>
      <mesh castShadow position={[0, 1.05, 0]}>
        <boxGeometry args={[0.44, 0.58, 0.24]} />
        <meshStandardMaterial color={COL_COAT} roughness={1} flatShading />
      </mesh>
      <mesh castShadow position={[0, 1.5, 0.02]}>
        <sphereGeometry args={[0.13, 10, 8]} />
        <meshStandardMaterial color={COL_SKIN} roughness={1} flatShading />
      </mesh>
      {/* legs */}
      <mesh castShadow position={[-0.12, 0.5, 0]}>
        <boxGeometry args={[0.16, 0.56, 0.18]} />
        <meshStandardMaterial color={COL_PANTS} roughness={1} flatShading />
      </mesh>
      <mesh castShadow position={[0.12, 0.5, 0]}>
        <boxGeometry args={[0.16, 0.56, 0.18]} />
        <meshStandardMaterial color={COL_PANTS} roughness={1} flatShading />
      </mesh>
      {/* arms crossed-ish — one raised slightly (the wave) */}
      <mesh castShadow position={[-0.28, 1.18, 0.05]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.11, 0.42, 0.12]} />
        <meshStandardMaterial color={COL_COAT} roughness={1} flatShading />
      </mesh>
      <mesh castShadow position={[0.3, 1.3, 0.1]} rotation={[0.4, 0, -1.1]}>
        <boxGeometry args={[0.11, 0.42, 0.12]} />
        <meshStandardMaterial color={COL_COAT} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

export default function Checkpoint() {
  // The hut sits west of the track; the raised barrier beside it.
  const hutX = CX - 7.5;
  const hutZ = CP_Z + 4;
  const hutY = gy(hutX, hutZ);

  const poleX = CX - 4.4;
  const poleZ = CP_Z;
  const poleY = gy(poleX, poleZ);

  return (
    <group>
      {/* ── Hut — breeze-block guard post with a flat roof ───────────── */}
      <group position={[hutX, hutY, hutZ]} rotation={[0, 0.12, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[1.3, 1.2, 1.5]} position={[0, 1.2, 0]} />
        </RigidBody>
        <mesh castShadow position={[0, 1.15, 0]}>
          <boxGeometry args={[2.5, 2.3, 2.9]} />
          <meshStandardMaterial color={COL_HUT} roughness={0.95} flatShading />
        </mesh>
        <mesh castShadow position={[0, 2.38, 0]}>
          <boxGeometry args={[2.9, 0.14, 3.3]} />
          <meshStandardMaterial color={COL_ROOF} roughness={1} flatShading />
        </mesh>
        {/* door void — dark inset on the track-facing side */}
        <mesh position={[1.26, 0.95, 0.4]}>
          <boxGeometry args={[0.06, 1.9, 0.85]} />
          <meshStandardMaterial color="#1c1916" roughness={1} />
        </mesh>
      </group>

      {/* ── Barrier — pole + RAISED arm (the wave-through) ───────────── */}
      <group position={[poleX, poleY, poleZ]}>
        <mesh castShadow position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 1.3, 8]} />
          <meshStandardMaterial color={COL_POLE} roughness={0.8} flatShading />
        </mesh>
        {/* arm pivots at pole top, raised ~72° — open */}
        <group position={[0, 1.25, 0]} rotation={[0, 0, 1.26]}>
          <mesh castShadow position={[1.7, 0, 0]}>
            <boxGeometry args={[3.4, 0.1, 0.12]} />
            <meshStandardMaterial color={COL_ARM} roughness={0.85} flatShading />
          </mesh>
          <mesh position={[0.9, 0, 0]}>
            <boxGeometry args={[0.5, 0.12, 0.14]} />
            <meshStandardMaterial color={COL_ARM_BAND} roughness={0.85} flatShading />
          </mesh>
          <mesh position={[2.3, 0, 0]}>
            <boxGeometry args={[0.5, 0.12, 0.14]} />
            <meshStandardMaterial color={COL_ARM_BAND} roughness={0.85} flatShading />
          </mesh>
        </group>
      </group>

      {/* ── Sandbag chicane — staggered, ≥4.5m off centreline ────────── */}
      <SandbagCluster x={CX - 4.6} z={CP_Z - 9} rotY={0.3} />
      <SandbagCluster x={CX + 4.8} z={CP_Z - 1} rotY={-0.2} />
      <SandbagCluster x={CX - 4.7} z={CP_Z + 8} rotY={0.15} />

      {/* ── Drums — dynamic, near the east road edge ─────────────────── */}
      <Drum x={CX + 3.6} z={CP_Z - 4} />
      <Drum x={CX + 3.9} z={CP_Z - 3.1} rust />

      {/* ── The soldier — by the hut, facing the road ────────────────── */}
      <Soldier x={hutX + 1.9} z={hutZ - 1.2} facing={1.45} />
    </group>
  );
}
