import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Planet, PlanetPlaceholder, SUN_DIR, type GlobeMarker } from "./Planet";
import { Starfield } from "./Starfield";
import { Orbit } from "./Controls";
import type { Body } from "../../data/sites";

interface Props {
  body: Body;
  markers: GlobeMarker[];
  activeId: string | null;
  onSelect: (id: string) => void;
  focus: { lat: number; lon: number } | null;
  lod?: "1k" | "2k" | "4k";
  stars?: boolean;
  onPick?: (lat: number, lon: number) => void;
}

/** Interactive single-body globe used in the Atlas and the Analog Lab. */
export default function GlobeView({ body, markers, activeId, onSelect, focus, lod, stars = true, onPick }: Props) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 3.4], fov: 40 }} aria-label={`${body} globe`}>
      <color attach="background" args={["#07080a"]} />
      <ambientLight intensity={body === "earth" ? 0.06 : 0.22} />
      <directionalLight position={SUN_DIR.clone().multiplyScalar(10)} intensity={body === "earth" ? 2.2 : 2.4} />
      {stars && <Starfield count={1800} />}
      <Suspense fallback={<PlanetPlaceholder body={body} />}>
        <Planet key={body} body={body} markers={markers} activeId={activeId} onSelect={onSelect} focus={focus} autoRotate={!focus} spin={0.035} lod={lod} onPick={onPick} />
      </Suspense>
      <Orbit />
    </Canvas>
  );
}
