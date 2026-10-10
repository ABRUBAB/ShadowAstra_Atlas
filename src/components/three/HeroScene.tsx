import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Planet, SUN_DIR, type GlobeMarker } from "./Planet";
import { Starfield } from "./Starfield";
import { EARTH_SITES } from "../../data/sites";

/**
 * Landing hero: Earth carrying every catalogued analog site (real coordinates), the Moon
 * on the ShadowAstra orbit ring, and Mars far behind. Earth streams 1K → 2K/4K.
 */
function Orbit({ reduced }: { reduced: boolean }) {
  const moon = useRef<THREE.Group>(null);
  const ring = useMemo(() => {
    const pts = new THREE.EllipseCurve(0, 0, 2.35, 2.35, 0, Math.PI * 2).getPoints(256);
    return new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, 0, p.y)));
  }, []);

  useFrame(({ clock }) => {
    if (!moon.current) return;
    const t = reduced ? 2.2 : clock.elapsedTime * 0.05 + 2.2;
    moon.current.position.set(Math.cos(t) * 2.35, 0, Math.sin(t) * 2.35);
  });

  return (
    <group rotation={[0.3, 0, -0.36]}>
      <lineLoop geometry={ring}>
        <lineBasicMaterial color="#cfd6e4" transparent opacity={0.16} />
      </lineLoop>
      <group ref={moon}>
        <Planet body="moon" radius={0.27} autoRotate={!reduced} spin={0.02} lod="1k" />
      </group>
    </group>
  );
}

function Rig({ pointer }: { pointer: React.RefObject<{ x: number; y: number }> }) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    const p = pointer.current;
    const k = Math.min(1, dt * 1.2);
    camera.position.x += (p.x * 0.28 - camera.position.x) * k;
    camera.position.y += (p.y * 0.16 - camera.position.y) * k;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/** Fires once the first frame with real textures has rendered. */
function Ready({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (!done.current) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

export default function HeroScene({ compact = false, onReady }: { compact?: boolean; onReady?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [visible, setVisible] = useState(true);
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    const move = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -((e.clientY / window.innerHeight) * 2 - 1) };
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("pointermove", move);
    };
  }, []);

  const markers: GlobeMarker[] = useMemo(
    () =>
      EARTH_SITES.map((s) => ({
        id: s.id,
        lat: s.lat,
        lon: s.lon,
        color: s.worlds.length > 1 ? "#f1ede6" : s.worlds[0] === "moon" ? "#c9c5bc" : "#e08a5f",
      })),
    [],
  );

  return (
    <div ref={wrap} className="absolute inset-0" aria-hidden>
      <Canvas
        dpr={[1, 1.6]}
        frameloop={visible ? "always" : "never"}
        camera={{ position: [0, 0, 5.2], fov: 38 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#07080a"]} />
        <ambientLight intensity={0.14} />
        <directionalLight position={SUN_DIR.clone().multiplyScalar(10)} intensity={2.4} />
        <Starfield count={compact ? 1400 : 2600} drift={reduced ? 0 : 0.003} />
        <Suspense fallback={null}>
          <group position={compact ? [0.35, 1.05, 0] : [1.15, -0.12, 0]} scale={compact ? 0.62 : 1}>
            <Planet body="earth" radius={1.25} markers={markers} autoRotate={!reduced} spin={0.035} tilt={0.18} />
            <Orbit reduced={reduced} />
          </group>
          <group position={[-4.6, 2.1, -7]}>
            <Planet body="mars" radius={0.42} autoRotate={!reduced} spin={0.02} lod="1k" />
          </group>
          {onReady && <Ready onReady={onReady} />}
        </Suspense>
        {!reduced && <Rig pointer={pointer} />}
      </Canvas>
    </div>
  );
}
