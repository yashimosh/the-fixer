# The Fixer

A narrative driving game about a Kurdish fixer working with foreign journalists during the war against ISIS (2014–2019). Player drives **Sor** through incidents — different years, different cargo, different stakes — across the mountain corridors of Iraqi Kurdistan and Rojava.

**Status:** playable vertical slice. The canonical West Mosul (June 2017) incident runs end-to-end: title screen → intro card → 800 m drive through chunk-streamed terrain with six story beats, a checkpoint set piece, a scripted Hilux, visible cargo stakes → ending variant by cargo state.

## Stack

- TypeScript + Vite
- Three.js + React Three Fiber (+ drei)
- WebGL2 (WebGPU upgrade planned)
- Rapier physics (Rust → WASM, via @react-three/rapier)
- Zustand for game state
- Howler + Tone.js for audio
- React for UI overlays
- Tauri (eventual) for Steam distribution

Full reasoning in `~/claude-brain/Projects/personal/the-fixer/STACK.md`.

## Lineage

The Fixer is the canonical successor to **[Border Run](https://github.com/yashimosh/border-run)** — a working browser prototype that taught us the form-language and the story direction. Border Run stays deployed at [borderrun.yashimosh.com](https://borderrun.yashimosh.com) as a historical artefact / lab. Active development moves here.

Design and writing carry over directly. Code does not — different stack, different scene-composition model, different physics engine.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Drive with WASD, brake with space.

## Build

```bash
npm run build
npm run preview
```

## Source layout

```
src/
├── main.tsx                # React root
├── App.tsx                 # Top-level: Canvas + UI overlays
├── store.ts                # Zustand game state (phase, cargo, beats)
├── styles.css              # Global styles
├── scene/
│   ├── World.tsx           # 3D scene root: sky, lights, fog, components
│   ├── terrainFn.ts        # Pure height/track/chunk functions — single source of truth
│   ├── Terrain.tsx         # Chunk-streamed heightfield + trimesh colliders
│   ├── sceneryFn.ts        # Per-chunk merged scenery geometry (walls/rubble/husks)
│   ├── Truck.tsx           # Rapier raycast vehicle + Sor silhouette + visible cargo
│   ├── Checkpoint.tsx      # Set piece anchoring the first cargo-risk beat
│   ├── Hilux.tsx           # Scripted vehicle ahead (third cargo-risk beat)
│   ├── SunLight.tsx        # Dawn sun whose shadow frustum follows the truck
│   ├── Pedestrians.tsx     # Civilians along the route, distance-culled
│   ├── ChaseCamera.tsx     # Third-person follow + speed FOV + landing shake
│   ├── StoryWatcher.tsx    # Beat triggers, cargo-risk checks, ending sequencing
│   ├── EngineAudio.tsx     # Procedural engine pitch (Tone.js)
│   ├── AmbientAudio.tsx    # Wind + distant rumble room tone
│   ├── PostFX.tsx          # Bloom + vignette
│   ├── truckRef.ts         # Shared mutable ref to truck rigid body
│   └── shakeRef.ts         # Camera shake channel
├── story/
│   └── incidents.ts        # Incident data: intro / beats / ending variants
├── input/
│   └── useKeys.ts          # Keyboard input hook
└── ui/
    ├── TitleScreen.tsx     # Anthology incident list (one playable, five locked)
    ├── StoryCard.tsx       # Intro + ending overlay
    ├── BeatFlash.tsx       # Transient mid-run beat text
    └── HUD.tsx             # Minimal four-corner HUD
```

## Project notes

The active brain folder for design / research / story / character is at `~/claude-brain/Projects/personal/the-fixer/`. That's where:

- `STACK.md` — technology stack rationale
- `RESEARCH-FIXER.md` — Kurdish fixer research library (real fixers, books, documentaries)
- `CHARACTER-SOR.md` — protagonist character bible, six incidents
- `REFERENCES.md` — game / film / visual references
- `LESSONS.md` — append-only build log
- `media/` — local-only reference assets (Syncthing-synced)

## Roadmap

1. ~~Hello world: Sor's truck on flat ground, drives with WASD, chase camera follows.~~ ✅
2. ~~Replace placeholder cuboid with real truck silhouette + materials.~~ ✅
3. ~~Rapier vehicle controller (proper wheels, suspension, traction model).~~ ✅
4. ~~Heightfield terrain via pure-function sampling.~~ ✅
5. ~~Chunk streaming.~~ ✅ (100 m slabs, merged per-chunk scenery, fog-hidden pop-in)
6. ~~Sor's cabin presence.~~ ✅ (silhouette at the wheel, tasbih, glasshouse cabin)
7. ~~Story system port from Border Run (intro / mid-run / ending cards in React).~~ ✅
8. ~~Canonical 2017 Mosul incident as the first complete playable run.~~ ✅ (800 m, checkpoint + Hilux world anchors, visible cargo)
9. Radio per year (music as character signal — needs licensed/original audio).
10. Photo mode (Sor leans on the truck — the moment the visual reference matters most).
11. Route divergence (run-3 playtest designer pick: shortcut = all risk beats flagged).
12. Remaining five incidents as data over the generic route system.
13. Web deploy at `thefixer.yashimosh.com` (Coolify on Hetzner) — GitHub Pages deploy exists.
14. Tauri wrap for Steam page (eventual).
