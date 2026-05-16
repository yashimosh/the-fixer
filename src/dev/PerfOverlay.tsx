// PerfOverlay — lazy-loaded perf tools. Only bundled when ?perf=1 or DEV.
//
// Keeping r3f-perf + RendererInfoExposer in a separate chunk prevents ~20 KB
// of perf tooling from shipping in every production bundle.
// App.tsx imports this via React.lazy(() => import('./dev/PerfOverlay')).

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Perf } from "r3f-perf";

// Exposes Three.js renderer.info to window.__fixerRendererInfo every 500ms.
// Playwright perf tests read it to assert draw call + triangle counts.
function RendererInfoExposer() {
  const { gl } = useThree();
  useEffect(() => {
    const id = setInterval(() => {
      (window as unknown as Record<string, unknown>).__fixerRendererInfo = {
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        points:    gl.info.render.points,
        lines:     gl.info.render.lines,
        textures:  gl.info.memory.textures,
      };
    }, 500);
    return () => clearInterval(id);
  }, [gl]);
  return null;
}

export default function PerfOverlay() {
  return (
    <>
      <Perf position="top-left" />
      <RendererInfoExposer />
    </>
  );
}
