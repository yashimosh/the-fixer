// Unit tests — incidents.ts (story data)
//
// Catches story-data regressions: beats in wrong order, missing endings,
// cargoRisk count drifting out of sync with cargoTotal, interiority
// violations in beat text (Rule 1 guard).

import { describe, it, expect } from 'vitest';
import { CANONICAL_2017 } from '../../src/story/incidents';

const { beats, endings, intro } = CANONICAL_2017;

// ── Beat structure ──────────────────────────────────────────────────────────
describe('incidents — beat ordering', () => {
  it('beats are sorted by ascending triggerZ', () => {
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i].triggerZ).toBeGreaterThan(beats[i - 1].triggerZ);
    }
  });

  it('all beats fall within the run corridor (SPAWN_Z -100 → END_Z +120)', () => {
    for (const beat of beats) {
      expect(beat.triggerZ).toBeGreaterThan(-100);
      expect(beat.triggerZ).toBeLessThan(120);
    }
  });

  it('has at least 4 beats (enough pacing across 220m)', () => {
    expect(beats.length).toBeGreaterThanOrEqual(4);
  });
});

// ── Cargo risk system ───────────────────────────────────────────────────────
describe('incidents — cargo risk balance', () => {
  const riskBeats = beats.filter(b => b.cargoRisk);

  it('has exactly 3 cargoRisk beats (matches cargoTotal:4 / failed:≤1 logic)', () => {
    // With cargoTotal=4, losing all 3 risk beats → cargoSecured=1 → "failed".
    // If this changes, the ending logic in StoryWatcher.tsx must change too.
    expect(riskBeats.length).toBe(3);
  });

  it('cargoRisk beats are spread across the run (not clustered)', () => {
    // First risk beat should not be at the very end; last not at the very start.
    expect(riskBeats[0].triggerZ).toBeLessThan(0);     // first risk is in south half
    expect(riskBeats[riskBeats.length - 1].triggerZ).toBeGreaterThan(40); // last is in north half
  });
});

// ── Ending variants ─────────────────────────────────────────────────────────
describe('incidents — endings', () => {
  it('all three ending variants exist (clean, partial, failed)', () => {
    expect(Array.isArray(endings.clean)).toBe(true);
    expect(Array.isArray(endings.partial)).toBe(true);
    expect(Array.isArray(endings.failed)).toBe(true);
  });

  it('each ending has at least 3 paragraphs', () => {
    expect(endings.clean.length).toBeGreaterThanOrEqual(3);
    expect(endings.partial.length).toBeGreaterThanOrEqual(3);
    expect(endings.failed.length).toBeGreaterThanOrEqual(3);
  });

  it('all endings start with a dateline header (JUNE 2017 — ...)', () => {
    expect(endings.clean[0]).toMatch(/^JUNE 2017/);
    expect(endings.partial[0]).toMatch(/^JUNE 2017/);
    expect(endings.failed[0]).toMatch(/^JUNE 2017/);
  });
});

// ── Intro ───────────────────────────────────────────────────────────────────
describe('incidents — intro', () => {
  it('intro starts with a dateline (JUNE 2017 — OLD CITY)', () => {
    expect(intro[0]).toMatch(/^JUNE 2017/);
  });

  it('intro has at least 5 paragraphs (enough context before DRIVE)', () => {
    expect(intro.length).toBeGreaterThanOrEqual(5);
  });
});

// ── AGENT-RULES Rule 1 guard (no interiority in beat text) ─────────────────
// Catches "you think", "you feel", "you wonder", "you remember", "you can't help"
// violations before they reach the live game. Not exhaustive but catches
// the most common slip patterns Claude has historically made on this file.
describe('incidents — Rule 1: Sor is silent (no interiority)', () => {
  const INTERIORITY_PATTERNS = [
    /\byou think\b/i,
    /\byou feel\b/i,
    /\byou wonder\b/i,
    /\byou remember\b/i,
    /\byou can't help\b/i,
    /\breminds you of\b/i,
    /\byou realize\b/i,
    /\byou know\b/i,
  ];

  it('beat texts contain no first-person interiority verbs', () => {
    for (const beat of beats) {
      for (const pattern of INTERIORITY_PATTERNS) {
        expect(beat.text, `Beat "${beat.text.slice(0, 40)}..." violates Rule 1`).not.toMatch(pattern);
      }
    }
  });

  it('ending texts contain no first-person interiority verbs', () => {
    const allEndingLines = [
      ...endings.clean,
      ...endings.partial,
      ...endings.failed,
    ];
    for (const line of allEndingLines) {
      for (const pattern of INTERIORITY_PATTERNS) {
        expect(line, `Ending line "${line.slice(0, 40)}..." violates Rule 1`).not.toMatch(pattern);
      }
    }
  });

  it('no beat text says "you don\'t mention it" (known interiority phrase)', () => {
    for (const beat of beats) {
      expect(beat.text).not.toContain("You don't mention it");
      expect(beat.text).not.toContain("you don't mention it");
    }
  });
});

// ── Editorial guard (Rule 6 — player is a worker, not editorialising) ───────
describe('incidents — Rule 6: no editorialising', () => {
  it('clean ending does not contain "People read the names"', () => {
    // Removed 2026-05-16: editorial assertion about audience behaviour.
    const combined = endings.clean.join(' ');
    expect(combined).not.toContain('People read the names');
  });
});
