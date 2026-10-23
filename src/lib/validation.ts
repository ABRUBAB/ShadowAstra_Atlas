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
  mixing?: { curve: { mix: number; known_median: number; known_top10: number }[]; chosen: number; independent_median: number; independent_ci: [number, number]; independent_top10: number };
  robustness: { target: string; task: string; weights_spearman: number; weights_top10: number; weights_top10_p10: number; noise_spearman: number; noise_top10: number }[];
  ablation: Record<string, { independent_median: number; known_median: number }>;
  model_zoo?: { rows: { id: string; name: string; hidden: number; hidden_top10: number; independent: number | null; members?: string[] | null }[]; chosen: string; minutes: number };
  notes: string[];
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
