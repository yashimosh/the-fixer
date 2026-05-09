// Static server for The Fixer.
// Serves the Vite-built dist/ folder. Health endpoint for Coolify probes.
//
// Intentionally minimal at this stage. Analytics, feedback, and any other
// server-side endpoints get added when the game has real users to serve.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const HOST = process.env.HOST || "0.0.0.0";
const PORT = parseInt(process.env.PORT || "4321", 10);

// Health check — Coolify pokes this on container start.
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Static assets. dist/ is the Vite build output; everything else 404s.
const DIST = path.join(__dirname, "dist");
app.use(express.static(DIST, {
  index: ["index.html"],
  maxAge: "1h",
  setHeaders: (res, filePath) => {
    // Hashed Vite assets can be cached aggressively; index.html shouldn't be.
    if (filePath.endsWith("index.html")) {
      res.setHeader("Cache-Control", "public, max-age=300");
    } else if (/\.(?:js|css|woff2?|png|jpg|webp|svg|glb|hdr|ktx2)$/.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  },
}));

// SPA fallback — any unmatched GET returns the index. The R3F game is a
// single page; client-side routing (when added) handles its own URLs.
app.get("*", (_req, res) => {
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`[the-fixer] serving on http://${HOST}:${PORT}`);
});
