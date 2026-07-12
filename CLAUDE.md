# The Fixer — UE 5.8 session rules

1. **Read the brain docs first** when touching story, character, or world content: `~/claude-brain/Projects/personal/the-fixer/AGENT-RULES.md` (six gate rules), `CHARACTER-SOR.md`, `RESEARCH-FIXER.md`, `VOICE.md`. Don't invent named specifics — the research library is the source of permitted specifics.
2. **C++ core, thin Blueprint layer.** All logic in `Source/TheFixer/` C++. Blueprints exist only to bind assets (meshes, input actions, materials). Never put gameplay logic in a Blueprint that Claude then can't read.
3. **Story text is data.** `Data/Incidents/*.json` — plain JSON, second person, present tense, observed fact. Text verbatim from the character bible where it exists; new text goes through `/story-critic` before commit.
4. **Engine:** UE 5.8.0 at `C:\Program Files\Epic Games\UE_5.8`. Build with `Engine\Build\BatchFiles\Build.bat TheFixerEditor Win64 Development -project=... -WaitMutex`.
5. **Don't commit** `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/` (gitignored). `Content/*.uasset` are binary — commit them, but keep them few and thin; prefer C++/JSON/config where possible.
