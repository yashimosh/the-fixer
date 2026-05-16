#!/usr/bin/env bash
# install-hooks.sh — installs git hooks for The Fixer
#
# Run once after cloning: bash scripts/install-hooks.sh
# Or via: npm run hooks:install
#
# What it installs:
#   pre-commit — runs unit tests before every commit. Blocks on failure.
#     The unit tests include AGENT-RULES guards (interiority check, beat ordering,
#     cargoRisk count, Rule 6 editorial) so story regressions fail before git.

set -e

HOOKS_DIR="$(git rev-parse --git-dir)/hooks"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[hooks] Installing pre-commit → $HOOKS_DIR/pre-commit"

cat > "$HOOKS_DIR/pre-commit" << 'HOOK'
#!/usr/bin/env bash
# pre-commit — runs unit tests to catch AGENT-RULES violations and story regressions.
# Installed by: bash scripts/install-hooks.sh

set -e

# Only run if story or terrain files changed (fast exit for non-story commits)
CHANGED=$(git diff --cached --name-only)

if echo "$CHANGED" | grep -qE 'src/story/|src/scene/terrainFn|src/telemetry/'; then
  echo "[pre-commit] Story/terrain/telemetry files changed — running unit tests..."
  npm run test:unit
  echo "[pre-commit] Unit tests passed ✓"
else
  echo "[pre-commit] No story/terrain files changed — skipping unit tests."
fi
HOOK

chmod +x "$HOOKS_DIR/pre-commit"
echo "[hooks] Done. pre-commit hook installed."
echo "[hooks] To bypass once (intentional): git commit --no-verify"
