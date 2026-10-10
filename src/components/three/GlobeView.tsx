import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, OrbitControls, Stars } from "@react-three/drei";
import { Planet, SUN_DIR, type GlobeMarker } from "./Planet";
import type { Body } from "../../data/sites";

interface Props {
  body: Body;
  markers: GlobeMarker[];
  activeId: string | null;
  onSelect: (id: string) => void;
  focus: { lat: number; lon: number } | null;
}

/** Interactive single-body globe used in the Atlas. */
export default function GlobeView({ body, markers, activeId, onSelect, focus }: Props) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 3.4], fov: 40 }} aria-label={`${body} globe`}>
      <color attach="background" args={["#020306"]} />
      <ambientLight intensity={body === "earth" ? 0.08 : 0.32} />
      <directionalLight position={SUN_DIR.clone().multiplyScalar(10)} intensity={body === "earth" ? 2.4 : 2.2} />
      <Stars radius={60} depth={30} count={2500} factor={2} saturation={0} fade speed={0.3} />
      <Suspense fallback={null}>
        <Planet
          key={body}
          body={body}
          markers={markers}
          activeId={activeId}
          onSelect={onSelect}
          focus={focus}
          autoRotate={!focus}
          spin={0.04}
        />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={1.6} maxDistance={6} rotateSpeed={0.5} zoomSpeed={0.6} />
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  );
}
