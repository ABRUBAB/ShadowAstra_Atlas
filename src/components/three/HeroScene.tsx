import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, Stars } from "@react-three/drei";
import * as THREE from "three";
import { Planet, SUN_DIR, type GlobeMarker } from "./Planet";
import { EARTH_SITES } from "../../data/sites";

/**
 * Landing hero: Earth (with every known analog site we catalogue), the Moon on an orbit ring
 * like the ShadowAstra mark, and Mars in the distance. The pins carry real coordinates.
 */
function Orbit({ reduced }: { reduced: boolean }) {
  const moon = useRef<THREE.Group>(null);
  const ring = useMemo(() => {
    const pts = new THREE.EllipseCurve(0, 0, 2.35, 2.35, 0, Math.PI * 2).getPoints(256);
    return new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, 0, p.y)));
  }, []);

  useFrame(({ clock }) => {
    if (!moon.current) return;
    const t = reduced ? 0.9 : clock.elapsedTime * 0.07 + 0.9;
    moon.current.position.set(Math.cos(t) * 2.35, 0, Math.sin(t) * 2.35);
  });

  return (
    <group rotation={[0.32, 0, -0.38]}>
      <lineLoop geometry={ring}>
        <lineBasicMaterial color="#75bbff" transparent opacity={0.28} />
      </lineLoop>
      <group ref={moon}>
        <Planet body="moon" radius={0.27} autoRotate={!reduced} spin={0.02} atmosphere />
      </group>
    </group>
  );
}

function Rig({ pointer }: { pointer: React.RefObject<{ x: number; y: number }> }) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    const p = pointer.current;
    camera.position.x += (p.x * 0.35 - camera.position.x) * Math.min(1, dt * 1.5);
    camera.position.y += (p.y * 0.2 - camera.position.y) * Math.min(1, dt * 1.5);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function HeroScene({ compact = false }: { compact?: boolean }) {
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
    window.addEventListener("pointermove", move);
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
        label: s.name,
        color: s.worlds[0] === "moon" ? "#d6dbe4" : "#e08a5f",
      })),
    [],
  );

  const earthX = compact ? 0 : 1.15;

  return (
    <div ref={wrap} className="absolute inset-0" aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        frameloop={visible ? "always" : "never"}
        camera={{ position: [0, 0, 5.2], fov: 38 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#020306"]} />
        <ambientLight intensity={0.16} />
        <directionalLight position={SUN_DIR.clone().multiplyScalar(10)} intensity={2.6} />
        <Stars radius={60} depth={40} count={4000} factor={2.4} saturation={0} fade speed={reduced ? 0 : 0.4} />
        <Suspense fallback={null}>
          <group position={compact ? [0.35, 1.05, 0] : [earthX, -0.15, 0]} scale={compact ? 0.62 : 1}>
            <Planet body="earth" radius={1.25} markers={markers} autoRotate={!reduced} spin={0.045} tilt={0.18} />
            <Orbit reduced={reduced} />
          </group>
          <group position={[-4.6, 2.1, -7]}>
            <Planet body="mars" radius={0.42} autoRotate={!reduced} spin={0.03} />
          </group>
        </Suspense>
        {!reduced && <Rig pointer={pointer} />}
        <AdaptiveDpr pixelated={false} />
      </Canvas>
    </div>
  );
}
