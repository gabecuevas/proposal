import { weekStarts } from "./series";
import type { DashboardActivityItem, DashboardOverview, DashboardSeriesPoint } from "./types";

export const SAMPLE_WEEKS = 122;

/** Deterministic PRNG so the sample chart shape is stable across renders. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeries(
  starts: Date[],
  seed: number,
  options: { max: number; density: number; spikeChance: number; spikeMax: number },
): DashboardSeriesPoint[] {
  const random = mulberry32(seed);
  return starts.map((start) => {
    let count = 0;
    if (random() < options.density) {
      count = 1 + Math.floor(random() * options.max);
      if (random() < options.spikeChance) {
        count = options.max + Math.floor(random() * (options.spikeMax - options.max));
      }
    }
    return { start: start.toISOString(), count };
  });
}

const sampleActivitySeeds: Array<{
  actor: string;
  documentTitle: string;
  minutesAgo: number;
}> = [
  { actor: "Jimmy Fallon", documentTitle: "Maestro Demo Proposal", minutesAgo: 4 },
  { actor: "Tina Fey", documentTitle: "SmartAcre Proposal", minutesAgo: 4 },
  { actor: "Tina Fey", documentTitle: "SmartAcre Proposal", minutesAgo: 5 },
  { actor: "Project Manager", documentTitle: "Awesome Demo for Bill", minutesAgo: 6 },
  { actor: "Project Manager", documentTitle: "Awesome Demo for Bill", minutesAgo: 11 },
  { actor: "Tina Fey", documentTitle: "SmartAcre Proposal", minutesAgo: 12 },
  { actor: "Jimmy Fallon", documentTitle: "Maestro Demo Proposal", minutesAgo: 14 },
];

function buildActivity(now: Date): DashboardActivityItem[] {
  return sampleActivitySeeds.map((seed, index) => ({
    id: `sample-activity-${index}`,
    kind: "View" as const,
    occurredAt: new Date(now.getTime() - seed.minutesAgo * 60 * 1000).toISOString(),
    actor: seed.actor,
    documentId: null,
    documentTitle: seed.documentTitle,
  }));
}

/**
 * Illustrative dashboard figures shown until the user dismisses the sample banner.
 * Never persisted — dismissing falls back to the workspace's real numbers.
 */
export function buildSampleOverview(now: Date = new Date()): DashboardOverview {
  const starts = weekStarts(SAMPLE_WEEKS, now);

  return {
    currency: "USD",
    totals: {
      inProgress: { count: 99, value: 7297670.12 },
      accepted: { count: 105, value: 6792459.75 },
      declined: { count: 5, value: 226327.24 },
    },
    series: {
      deliveries: buildSeries(starts, 20140601, {
        max: 3,
        density: 0.62,
        spikeChance: 0.06,
        spikeMax: 6,
      }),
      views: buildSeries(starts, 20141031, {
        max: 12,
        density: 0.78,
        spikeChance: 0.08,
        spikeMax: 36,
      }),
    },
    activity: buildActivity(now),
    teamMemberCount: 14,
  };
}
