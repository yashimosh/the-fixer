// App — top-level component. Hosts the R3F Canvas and the React UI overlays.
//
// The Canvas hosts everything 3D (scene, physics world, camera, lights, truck).
// The UI overlays (HUD, story cards, intro/ending) are React siblings of the
// Canvas, in normal DOM. R3F + React unifies the two trees.
//
// Renderer: WebGL2 by default for now. WebGPU upgrade planned (see STACK.md);
// the renderer swap is a Canvas-prop change, not a code rewrite.

import { Suspense, lazy, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { Physics } from "@react-three/rapier";
import World from "./scene/World";
import StoryWatcher from "./scene/StoryWatcher";
import HUD from "./ui/HUD";
import StoryCard from "./ui/StoryCard";
import BeatFlash from "./ui/BeatFlash";
import { trackSessionEnd } from "./telemetry";
import { useGame } from "./store";

// ── Performance overlay — r3f-perf ──────────────────────────────────────────
// Enabled in dev mode OR when ?perf=1 is in the URL (works in production too,
// useful for diagnosing live perf issues without a local build).
// Lazy-imported so the ~20 KB r3f-perf chunk is NOT in the main production
// bundle unless explicitly requested. Vite code-splits it automatically.
const SHOW_PERF =
  import.meta.env.DEV ||
  new URLSearchParams(window.location.search).has("perf");

const PerfOverlay = SHOW_PERF
  ? lazy(() => import("./dev/PerfOverlay"))
  : null;

export default function App() {
  // Session-end telemetry — fires when player closes/navigates away mid-run.
  // Gives us data on where they quit if the run didn't complete.
  useEffect(() => {
    const onUnload = () => {
      const { phase, cargoSecured } = useGame.getState();
      // Read truck Z from the truckRef if available — best effort
      const truckZ = 0; // TODO: expose truckRef.current?.translation()?.z via store
      trackSessionEnd(truckZ, cargoSecured, phase);
    };
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  }, []);

  return (
    <>
      <div className="stage">
        <Canvas
          shadows
          camera={{ position: [0, 6, 14], fov: 60, near: 0.1, far: 800 }}
          gl={{
            antialias: false, // SMAA / postfx will handle this later
            powerPreference: "high-performance",
            stencil: false,
            depth: true,
            preserveDrawingBuffer: true, // helps screenshot capture in headless tools
          }}
          // ACESFilmic + sRGB: without these the Sky shader outputs un-tone-mapped
          // linear RGB that reads as washed-out grey in the browser.
          onCreated={({ gl }) => {
            gl.toneMapping = ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.1;  // slightly brighter base; bloom adds punch on top
            gl.outputColorSpace = SRGBColorSpace;
          }}
          dpr={[1, 1.75]} // device pixel ratio cap; matches Border Run's perf budget
        >
          <Physics gravity={[0, -12, 0]} timeStep="vary">
            <World />
            {/* Reads truck z each frame, fires beats and the ending. */}
            <StoryWatcher />
          </Physics>

          {/* Performance overlay — only in dev or ?perf=1; lazy chunk */}
          {SHOW_PERF && PerfOverlay && (
            <Suspense fallback={null}>
              <PerfOverlay />
            </Suspense>
          )}
        </Canvas>
      </div>

      {/* React-DOM UI siblings of the Canvas. Order matters for stacking. */}
      <HUD />
      <BeatFlash />
      <StoryCard />
    </>
  );
}
