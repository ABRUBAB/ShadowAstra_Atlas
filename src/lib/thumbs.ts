import { useEffect, useState } from "react";
import { earthVisible, sampleImagery } from "./terrain";

/** Real satellite thumbnails for candidate places (50 km, north up), cached and queued. */
const cache = new Map<string, Promise<string>>();
let running = 0;
const queue: (() => void)[] = [];

function schedule<T>(job: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      running++;
      job()
        .then(resolve, reject)
        .finally(() => {
          running--;
          queue.shift()?.();
        });
    };
    if (running < 3) run();
    else queue.push(run);
  });
}

export function earthThumb(lat: number, lon: number, size = 192, km = 50): Promise<string> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${size},${km}`;
  let p = cache.get(key);
  if (!p) {
    p = schedule(() => sampleImagery(earthVisible(lat), lat, lon, km, size).then((c) => c.toDataURL("image/jpeg", 0.82)));
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export function useEarthThumb(lat: number | null, lon: number | null, size = 192, km = 50) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (lat === null || lon === null) return;
    let alive = true;
    setUrl(null);
    earthThumb(lat, lon, size, km)
      .then((u) => alive && setUrl(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lat, lon, size, km]);
  return url;
}
