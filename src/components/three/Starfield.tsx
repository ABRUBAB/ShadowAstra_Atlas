import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** A quiet, static-feeling starfield: one draw call, size attenuation, tiny drift. */
export function Starfield({ count = 2600, radius = 80, drift = 0.004 }: { count?: number; radius?: number; drift?: number }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const r = radius * (0.6 + Math.random() * 0.4);
      const s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
      // stellar temperatures: mostly white, a few warm and a few cool
      const k = Math.random();
      const c = k < 0.12 ? [1, 0.86, 0.72] : k < 0.2 ? [0.78, 0.86, 1] : [1, 1, 1];
      const b = 0.35 + Math.random() ** 3 * 0.65;
      col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [count, radius]);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * drift;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.16} sizeAttenuation vertexColors transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}
