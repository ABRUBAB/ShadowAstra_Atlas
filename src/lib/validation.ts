import { useEffect, useState } from "react";
import type { World } from "../data/sites";

/** Results of pipeline/s14_validate.py (public/data/validation.json). All ranks are "top X% of all land". */

export interface Spread {
  median: number;
  ci: [number | null, number | null];
  top10: number;
  top25: number;
}

export interface IndependentSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  world: World;
  jobs: string[];
  source: string;
  cell: number;
  rock: string | null;
  nearest_known: [string, number];
  hidden_known: number;
  formula: number;
  blend: number;
  model: number;
  baseline: number;
  dry_only: number;
  remote_only: number;
  cover: number;
  formula_rocks: number;
  chosen_mix?: number;
}

export interface Summary {
  n: number;
  formula?: Spread;
  blend?: Spread;
  model?: Spread;
  baseline?: Spread;
  dry_only?: Spread;
  remote_only?: Spread;
  formula_rocks?: Spread;
}

export interface Validation {
  generated: string;
  cells: number;
  independent: { sites: IndependentSite[]; all: Summary; moon: Summary; mars: Summary };
  known: { rows: { id: string; name: string; world: World; formula: number; formula_rocks: number; baseline: number }[]; all: Summary };
  jobs: { rows: { id: string; own: number; other: number; per_job: Record<string, number> }[]; better_share: number; median_gain: number; sign_test_p: number | null };
  mixing?: { curve: { mix: number; known_median: number; known_top10: number; independent_median?: number }[]; chosen: number; best_on_known: number; shipped: number; independent_median: number; independent_ci: [number, number]; independent_top10: number };
  robustness: { target: string; task: string; weights_spearman: number; weights_top10: number; weights_top10_p10: number; noise_spearman: number; noise_top10: number }[];
  ablation: Record<string, { independent_median: number; known_median: number }>;
  model_zoo?: { rows: { id: string; name: string; hidden: number; hidden_top10: number; independent: number | null; members?: string[] | null }[]; chosen: string; minutes: number };
  minerals?: MineralTest;
  terrain_ai?: TerrainAiTest | null;
  pinpoint?: PinpointTest;
  model?: string;
  notes: string[];
}

/** A without/with comparison over a group of sites (lower ranks are better). */
export interface Paired {
  n: number;
  without?: number;
  with?: number;
  better?: number;
  worse?: number;
}

export interface MineralTest {
  known: Paired;
  independent: Paired;
  known_emit: Paired;
  independent_emit: Paired;
  shipped: boolean;
  emit_places: number;
  targets: Record<string, { families: string[]; source: string }>;
  /** pipeline/s18: minerals as extra inputs to the learned model. */
  model?: {
    decision: "with" | "without";
    minutes: number;
    hidden: Record<"all" | "emit_seen" | "mars", { n: number; without: { median: number; top10: number }; with: { median: number; top10: number }; with_better: number; with_worse: number }>;
    independent: Record<"all" | "emit_seen" | "mars", { n: number; without: { median: number; top10: number }; with: { median: number; top10: number }; with_better: number; with_worse: number }>;
  };
}

type ShapeSummary = { n: number; formula: number; learned: number; both: number; formula_top20: number; learned_top20: number; both_top20: number };
/** pipeline/s23: does the best 10 km window of a place hold the real field site? (rank 0 = best window, chance 0.5) */
export interface PinpointSummary {
  n: number;
  median_rank: number;
  mean_rank: number;
  top_quarter: number;
  better_half: number;
  sign_test_p: number;
  wilcoxon_p: number;
  best_km_median: number;
  random_km_median: number;
}

export interface PinpointTest {
  all: PinpointSummary;
  known: PinpointSummary;
  independent: PinpointSummary;
  works: boolean;
  rows: { id: string; name: string; group: "known" | "independent"; target: string; rank: number; windows: number; best_km_from_site: number; median_km_from_site: number }[];
  method: { spacing_km: number; window_km: number; stride_km: number; area_km: number };
}

export interface TerrainAiTest {
  model?: string;
  minutes?: number;
  steps?: number;
  same_world_neighbours?: number;
  chance_same_world?: number;
  known?: ShapeSummary;
  independent?: ShapeSummary;
  pairs?: ShapeSummary;
  /** The full score (factors plus learned model) with each ground-shape source. */
  full_score?: Record<"formula" | "learned" | "both", { known_median: number; known_top10: number; independent_median: number; independent_top10: number }> & { best_on_known: "formula" | "learned" | "both" };
}

let cache: Promise<Validation> | null = null;

export function loadValidation(): Promise<Validation> {
  if (!cache) {
    cache = fetch("/data/validation.json").then((r) => {
      if (!r.ok) throw new Error(`validation.json ${r.status}`);
      return r.json() as Promise<Validation>;
    });
    cache.catch(() => (cache = null));
  }
  return cache;
}

/** public/data/review.json (pipeline/s24_review.py): the expert review of the top candidates. */
export interface Review {
  status: "pending" | "done";
  reviewer: string;
  generated: string;
  candidates: { id: string; target: string; job: string; lat: number; lon: number; place: string; score: number }[];
  rubric: { id: string; label: string }[];
  reviewed?: number;
  mean?: Record<string, number>;
  overall?: { yes: number; maybe: number; no: number };
}

let reviewPromise: Promise<Review | null> | null = null;

/** The expert review, or null while loading or when there is none. */
export function useReview() {
  const [r, setR] = useState<Review | null>(null);
  useEffect(() => {
    let alive = true;
    reviewPromise ??= fetch("/data/review.json").then((x) => (x.ok ? (x.json() as Promise<Review>) : null)).catch(() => null);
    reviewPromise.then((x) => alive && setR(x));
    return () => {
      alive = false;
    };
  }, []);
  return r;
}

export function useValidation() {
  const [v, setV] = useState<Validation | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    loadValidation()
      .then((x) => alive && setV(x))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);
  return { v, error };
}
