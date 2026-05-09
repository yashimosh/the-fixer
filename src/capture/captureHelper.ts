// captureHelper — exposes window.__fixerRecord(seconds, filename?) as a
// one-call recording API. Composites the WebGL canvas + DOM HUD elements
// onto a third canvas each rAF tick, then MediaRecorder that composite.
//
// Why composite: canvas.captureStream() only captures the WebGL layer.
// Cargo dots, beat flash, speed readout, and HUD labels are DOM elements
// rendered over the canvas — they'd be invisible in a raw canvas capture.
//
// Usage (from browser console or extension JS injection):
//   window.__fixerRecord(40)              // record 40s, auto-downloads fixer-20260509.webm
//   window.__fixerRecord(40, 'my-clip')   // custom filename (no extension needed)
//
// The truck is driven separately via window.__fixerKeys.fwd = true.

const FONT       = "ui-monospace, SFMono-Regular, Menlo, monospace";
const FG         = "rgba(232,230,225,0.92)";
const FG_DIM     = "rgba(232,230,225,0.55)";
const FG_FAINT   = "rgba(232,230,225,0.10)";
const ACCENT     = "rgba(224,200,120,0.55)";
const BG_SEMI    = "rgba(11,11,12,0.55)";

interface FixerRecord {
  (durationSeconds: number, filename?: string): Promise<void>;
}

function drawHUD(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // ── Read live state from DOM ──────────────────────────────────────────────
  const speedEl    = document.querySelector<HTMLElement>(".speed-num");
  const dotsEl     = document.querySelector<HTMLElement>(".cargo-dots");
  const beatEl     = document.querySelector<HTMLElement>(".beat-flash");
  const hudTL      = document.querySelector<HTMLElement>(".hud.tl");
  const hudBL      = document.querySelector<HTMLElement>(".hud.bl");

  const speedText  = speedEl?.textContent?.trim() ?? "";
  const beatText   = beatEl?.textContent?.trim() ?? "";
  const beatVisible = beatEl?.classList.contains("show") ?? false;

  // Cargo dots — count on vs off
  const allDots    = dotsEl ? Array.from(dotsEl.querySelectorAll(".dot")) : [];
  const dotsOn     = allDots.filter(d => d.classList.contains("dot--on")).length;
  const dotsTotal  = allDots.length;

  // HUD top-left text lines
  const tlLines    = hudTL
    ? Array.from(hudTL.querySelectorAll<HTMLElement>("div,span,.k,.v"))
        .map(el => el.textContent?.trim())
        .filter(Boolean) as string[]
    : [];

  // HUD bottom-left (WASD hints) — only when visible
  const blVisible  = hudBL && getComputedStyle(hudBL).display !== "none";

  const PAD = 14;
  const FONT_SM  = `11px ${FONT}`;
  const FONT_MED = `13px ${FONT}`;
  const FONT_SPD = `500 22px ${FONT}`;

  ctx.save();
  ctx.textBaseline = "top";

  // ── Top-left: "the fixer" / dateline ─────────────────────────────────────
  if (tlLines.length > 0) {
    ctx.font = FONT_SM;
    ctx.letterSpacing = "0.02em";
    let y = PAD;
    tlLines.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? FG_DIM : FG;
      ctx.fillText(line, PAD, y);
      y += 15;
    });
  }

  // ── Top-right: cargo dots ─────────────────────────────────────────────────
  if (dotsTotal > 0) {
    const DOT = 6;
    const GAP = 5;
    const totalW = dotsTotal * DOT + (dotsTotal - 1) * GAP;
    let x = w - PAD - totalW;
    const y = PAD;
    for (let i = 0; i < dotsTotal; i++) {
      ctx.fillStyle = i < dotsOn ? ACCENT : FG_FAINT;
      ctx.fillRect(x, y, DOT, DOT);
      x += DOT + GAP;
    }
  }

  // ── Bottom-right: speed readout ───────────────────────────────────────────
  if (speedText) {
    ctx.textBaseline = "bottom";
    ctx.font = FONT_SPD;
    ctx.fillStyle = FG;
    ctx.globalAlpha = 0.85;
    const numW = ctx.measureText(speedText).width;
    ctx.fillText(speedText, w - PAD - numW - 28, h - PAD);

    ctx.font = FONT_SM;
    ctx.globalAlpha = 0.45;
    ctx.letterSpacing = "0.1em";
    ctx.fillText("km/h", w - PAD, h - PAD - 2);
    ctx.globalAlpha = 1;
    ctx.letterSpacing = "0";
    ctx.textBaseline = "top";
  }

  // ── Bottom-left: WASD hints ───────────────────────────────────────────────
  if (blVisible) {
    ctx.textBaseline = "bottom";
    ctx.font = FONT_SM;
    const hints = [["WASD","drive"],["SPACE","brake"]];
    let y = h - PAD;
    [...hints].reverse().forEach(([k, v]) => {
      ctx.fillStyle = FG_DIM; ctx.fillText(k, PAD, y);
      const kw = ctx.measureText(k + "  ").width;
      ctx.fillStyle = FG;     ctx.fillText(v, PAD + kw, y);
      y -= 15;
    });
    ctx.textBaseline = "top";
  }

  // ── Beat flash: centered top strip ───────────────────────────────────────
  if (beatVisible && beatText) {
    const MAX_W = 620;
    ctx.font = FONT_MED;
    ctx.letterSpacing = "0.02em";
    const tw    = Math.min(ctx.measureText(beatText).width + 36, MAX_W);
    const bx    = (w - tw) / 2;
    const by    = 32;
    const bh    = 38;

    // bg panel
    ctx.fillStyle = BG_SEMI;
    ctx.fillRect(bx, by, tw, bh);

    // border
    ctx.strokeStyle = "rgba(232,230,225,0.25)";
    ctx.lineWidth   = 1;
    ctx.strokeRect(bx, by, tw, bh);

    // text
    ctx.fillStyle = FG;
    ctx.globalAlpha = 0.92;
    ctx.textBaseline = "middle";
    ctx.fillText(beatText, bx + 18, by + bh / 2, tw - 36);
    ctx.textBaseline = "top";
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function setupCapture() {
  const record: FixerRecord = (durationSeconds, filename) => {
    return new Promise((resolve, reject) => {
      const glCanvas = document.querySelector<HTMLCanvasElement>("canvas");
      if (!glCanvas) { reject(new Error("WebGL canvas not found")); return; }

      // Composite canvas — use CSS display size so HUD coordinates (CSS pixels)
      // align correctly. drawImage scales the DPR-upscaled GL canvas down to fit.
      const comp = document.createElement("canvas");
      comp.width  = glCanvas.offsetWidth  || 1568;
      comp.height = glCanvas.offsetHeight || 771;
      const ctx   = comp.getContext("2d");
      if (!ctx) { reject(new Error("2D context unavailable")); return; }

      const stream   = comp.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9" : "video/webm";
      const rec      = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
      const chunks: Blob[] = [];

      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url  = URL.createObjectURL(blob);
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const fname = `${filename ?? `fixer-gameplay-${date}`}.webm`;

        // Expose blob URL on window so it can be manually downloaded if auto-click
        // is blocked by Chrome's download gate (requires user-gesture context).
        (window as unknown as Record<string, unknown>).__fixerLastBlobUrl = url;
        (window as unknown as Record<string, unknown>).__fixerLastFilename = fname;
        (window as unknown as Record<string, unknown>).__fixerDownload = () => {
          const a    = document.createElement("a");
          a.href     = url;
          a.download = fname;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          // URL intentionally NOT revoked here — keep blob alive so the
          // extension can call __fixerDownload() again if the first attempt
          // was silently blocked. Revoke manually when confirmed downloaded.
        };

        // Do NOT auto-call __fixerDownload — Chrome blocks a.click() from setTimeout
        // (no user gesture). Call window.__fixerDownload() manually from the
        // extension JS injection context after recording completes.

        cancelAnimationFrame(rafId);
        console.info(`[fixer] Recording complete: ${fname} (${(blob.size / 1024).toFixed(0)} KB)`);
        resolve();
      };

      rec.start(100);

      // rAF loop: composite GL frame + HUD every tick
      let rafId = 0;
      const w = comp.width;
      const h = comp.height;

      const tick = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(glCanvas, 0, 0, w, h);
        drawHUD(ctx, w, h);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      setTimeout(() => rec.stop(), durationSeconds * 1000);
    });
  };

  // __fixerDrive(seconds) — drives forward for the given duration.
  // Pulses fwd=true in 80ms on / 20ms off bursts to keep speed ~7 m/s
  // (below cargo-risk threshold of 8 m/s but still covering the track).
  // After the drive completes, releases all keys.
  (window as unknown as Record<string, unknown>).__fixerDrive = (seconds: number) => {
    const keys = (window as unknown as Record<string, unknown>).__fixerKeys as Record<string, boolean> | undefined;
    if (!keys) { console.error("[fixer] __fixerKeys not ready"); return; }

    let elapsed = 0;
    const TICK = 100; // ms

    const interval = setInterval(() => {
      elapsed += TICK;
      if (elapsed >= seconds * 1000) {
        keys.fwd = false;
        clearInterval(interval);
        return;
      }
      // Pulse: 80ms on, 20ms off each 100ms tick → moderate controlled speed
      keys.fwd = true;
      setTimeout(() => { if (keys.fwd) keys.fwd = false; }, 80);
      setTimeout(() => { keys.fwd = true; },                 90);
    }, TICK);

    console.info(`[fixer] Driving for ${seconds}s…`);
    return interval;
  };

  (window as unknown as Record<string, unknown>).__fixerRecord = record;
  console.info(
    "[fixer] captureHelper ready.\n" +
    "  Drive:  window.__fixerDrive(35)          — drives for 35s at ~7 m/s\n" +
    "  Record: window.__fixerRecord(45)          — downloads fixer-gameplay-<date>.webm\n" +
    "  Manual: window.__fixerDownload?.()        — trigger download if auto blocked"
  );
}

// Auto-init when imported
setupCapture();
