// App — top-level component. Hosts the R3F Canvas and the React UI overlays.
//
// The Canvas hosts everything 3D (scene, physics world, camera, lights, truck).
// The UI overlays (HUD, story cards, intro/ending) are React siblings of the
// Canvas, in normal DOM. R3F + React unifies the two trees.
//
// Renderer: WebGL2 by default for now. WebGPU upgrade planned (see STACK.md);
// the renderer swap is a Canvas-prop change, not a code rewrite.

import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { Physics } from "@react-three/rapier";
import World from "./scene/World";
import StoryWatcher from "./scene/StoryWatcher";
import HUD from "./ui/HUD";
import StoryCard from "./ui/StoryCard";
import BeatFlash from "./ui/BeatFlash";

export default function App() {
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
            gl.toneMappingExposure = 0.9;
            gl.outputColorSpace = SRGBColorSpace;
          }}
          dpr={[1, 1.75]} // device pixel ratio cap; matches Border Run's perf budget
        >
          <Physics gravity={[0, -9.81, 0]} timeStep="vary">
            <World />
            {/* Reads truck z each frame, fires beats and the ending. */}
            <StoryWatcher />
          </Physics>
        </Canvas>
      </div>

      {/* React-DOM UI siblings of the Canvas. Order matters for stacking. */}
      <HUD />
      <BeatFlash />
      <StoryCard />
    </>
  );
}
