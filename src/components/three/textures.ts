import { useEffect, useState } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { Body } from "../../data/sites";

/**
 * NASA mosaics in three sizes (scripts/build_textures.py). We paint the 1K version
 * immediately (~60 to 150 KB) and swap in the sharper one once it has streamed in.
 */
type Lod = "1k" | "2k" | "4k";

const NAME: Record<Body | "night", string> = {
  earth: "earth_day",
  night: "earth_night",
  moon: "moon_lroc",
  mars: "mars_viking",
};

export function textureUrl(kind: Body | "night", lod: Lod) {
  return `/textures/${NAME[kind]}_${kind === "night" && lod === "4k" ? "2k" : lod}.webp`;
}

export function bestLod(): Lod {
  if (typeof window === "undefined") return "2k";
  const px = Math.max(window.innerWidth, window.innerHeight) * Math.min(window.devicePixelRatio || 1, 2);
  const slow = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (slow?.saveData || /2g|3g/.test(slow?.effectiveType ?? "")) return "1k";
  return px > 2200 ? "4k" : "2k";
}

function prep(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const loader = new THREE.TextureLoader();

/** Suspends on the tiny texture, then upgrades in the background. */
export function useProgressiveTexture(kind: Body | "night", target: Lod) {
  const low = useLoader(THREE.TextureLoader, textureUrl(kind, "1k"));
  const [tex, setTex] = useState<THREE.Texture>(() => prep(low));

  useEffect(() => {
    if (target === "1k") return;
    let alive = true;
    loader.loadAsync(textureUrl(kind, target)).then((hi) => {
      if (alive) setTex(prep(hi));
    });
    return () => {
      alive = false;
    };
  }, [kind, target]);

  return tex;
}
