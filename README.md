# The Fixer

A narrative driving game about a Kurdish fixer working with foreign journalists during the war against ISIS (2014–2019). Player drives **Sor** through incidents — different years, different cargo, different stakes — across the mountain corridors of Iraqi Kurdistan and Rojava.

**Status:** pre-production. Foundation and "hello world" only.

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
├── styles.css              # Global styles
├── scene/
│   ├── World.tsx           # 3D scene: lights, sky, ground, truck, camera
│   ├── Truck.tsx           # Sor's vehicle (placeholder cuboid for now)
│   ├── Ground.tsx          # Static ground plane
│   ├── ChaseCamera.tsx     # Third-person camera follow
│   └── truckRef.ts         # Shared mutable ref to truck rigid body
├── input/
│   └── useKeys.ts          # Keyboard input hook
└── ui/
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

1. **Hello world (this commit):** Sor's truck on flat ground, drives with WASD, chase camera follows.
2. Replace placeholder cuboid with real truck silhouette + materials.
3. Rapier vehicle controller (proper wheels, suspension, traction model).
4. Heightfield terrain via pure-function sampling.
5. Chunk streaming from day one.
6. Sor's cabin presence (hands on wheel, tasbih, scarf).
7. Story system port from Border Run (intro / mid-run / ending cards in React).
8. Canonical 2017 Mosul incident as the first complete playable run.
9. Web deploy at `thefixer.yashimosh.com` (Coolify on Hetzner).
10. Tauri wrap for Steam page (eventual).
