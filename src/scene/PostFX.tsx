// PostFX — post-processing pass for The Fixer.
// Bloom: headlights glow (emissiveIntensity 1.6), sun glints on glass.
// Vignette: soft dark edge frames the truck.
//
// @react-three/postprocessing 2.16.2 — EffectComposer children must be
// Effect instances (via forwardRef). Comments inside EffectComposer cause
// TypeScript to see `undefined` children (JSX block-comment quirk); they're
// removed here. Component types are cast to React.FC to satisfy strict JSX.
//
// KernelSize.MEDIUM for bloom. Drop to SMALL if mobile fps tanks.

import type React from "react";
import {
  EffectComposer,
  Bloom,
  Vignette,
} from "@react-three/postprocessing";
import { KernelSize } from "postprocessing";

// Re-typed to React.FC so JSX children compile in strict mode.
// postprocessing 2.x return types are loosely typed (can be undefined).
type FC<P> = React.FC<P>;
const BloomFX    = Bloom          as unknown as FC<React.ComponentProps<typeof Bloom>>;
const VignetteFX = Vignette       as unknown as FC<React.ComponentProps<typeof Vignette>>;
const ComposerFX = EffectComposer as unknown as FC<React.ComponentProps<typeof EffectComposer>>;

export default function PostFX() {
  return (
    <ComposerFX enableNormalPass={false}>
      <BloomFX
        intensity={1.2}
        luminanceThreshold={0.75}
        luminanceSmoothing={0.08}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />
      <VignetteFX offset={0.35} darkness={0.55} />
    </ComposerFX>
  );
}
