# The Fixer (UE 5.8)

A narrative driving game about a Kurdish fixer working with foreign journalists during the war against ISIS (2014–2019). Player drives **Sor** through an anthology of six incidents across the mountain corridors of Iraqi Kurdistan and Rojava.

This is the Unreal Engine 5.8 rebuild. The story direction, character bible, research library, and writing rules carry over from the earlier web prototype; the code does not.

**Canonical project docs:** `~/claude-brain/Projects/personal/the-fixer/` — read `AGENT-RULES.md`, `CHARACTER-SOR.md`, `RESEARCH-FIXER.md`, `VOICE.md` before touching story or world content.

## Layout

| Path | What |
|------|------|
| `Source/TheFixer/` | C++ game module — vehicle, story system, game mode |
| `Source/TheFixer/Vehicle/` | Chaos-physics Land Cruiser pawn + wheel classes |
| `Source/TheFixer/Story/` | Incident types + JSON-loading subsystem |
| `Data/Incidents/*.json` | Story text — one file per incident, plain JSON, human-editable |
| `Content/` | UE assets (maps, meshes, input assets, Blueprints) |
| `Config/` | Project settings (DX12/SM6, Lumen, async physics for Chaos vehicles) |

## Working rules

- **C++ core, thin Blueprint layer.** Systems, physics tuning defaults, and data loading live in C++ (text, reviewable, AI-editable). Blueprints only bind assets: `BP_SorVehicle` assigns the skeletal mesh, wheel bones, and Enhanced Input assets.
- **Story text lives in `Data/Incidents/`, not in assets.** Editable with any text editor, no engine needed. Packaged builds stage the folder as loose files.
- **Writing register:** second person, present tense, observed fact. See `AGENT-RULES.md` in the brain — the six rules are gates, not aspirations.

## Build

Requires UE 5.8 (Epic Games Launcher) and VS 2022 Build Tools with the C++ workload.

```
"C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" TheFixerEditor Win64 Development -project="<path>\TheFixer.uproject" -WaitMutex
```

Then open `TheFixer.uproject`.
