import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Grid } from "../../lib/grid";
import { latLonToVec3 } from "../../lib/geo";

/**
 * Earth drawn as its 80,206 measured land areas, one dot each. The dots take a data
 * layer (0 to 1 per place) and a tint; changing either sweeps the new colours across
 * the globe from west to east. Drag to spin; the page still scrolls on touch screens.
 */

export interface DotGlobeProps {
  grid: Grid | null;
  /** One value per land cell, 0 to 1 (already ranked). Null shows plain dots. */
  values: Float32Array | null;
  /** Colour of the highest values. */
  tint: string;
  /** Longitude to face the camera at the start. */
  startLon?: number;
  tilt?: number;
  spin?: number;
  className?: string;
  /** Dot size in CSS pixels. */
  size?: number;
  /** Optional rings, e.g. test sites. */
  rings?: { lat: number; lon: number; color: string }[];
}

const BASE = new THREE.Color("#2b2d34");
const WHITE = new THREE.Color("#fff6e2");

const vertex = /* glsl */ `
  attribute vec3 colorA;
  attribute vec3 colorB;
  attribute float lonN;
  uniform float t;
  uniform float size;
  varying vec3 vColor;
  varying float vFacing;
  varying float vFront;
  void main() {
    float edge = t * 1.18 - 0.09;
    float f = smoothstep(edge - 0.09, edge, lonN);
    f = 1.0 - f;
    vColor = mix(colorA, colorB, f);
    vFront = (1.0 - smoothstep(0.0, 0.05, abs(lonN - edge))) * step(t, 0.999);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelViewMatrix) * position);
    vFacing = dot(n, normalize(-mv.xyz));
    gl_PointSize = size * (0.55 + 0.45 * smoothstep(0.0, 0.5, vFacing)) * (1.0 + vFront * 0.6);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vFacing;
  varying float vFront;
  void main() {
    if (vFacing < 0.0) discard;
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.32, d) * smoothstep(0.0, 0.28, vFacing);
    vec3 col = vColor + vec3(1.0, 0.85, 0.55) * vFront * 0.55;
    gl_FragColor = vec4(col, a);
  }
`;

function colorsFor(n: number, values: Float32Array | null, tint: string, out: Float32Array) {
  const T = new THREE.Color(tint);
  const c = new THREE.Color();
  for (let k = 0; k < n; k++) {
    const v = values ? values[k] : 0.12;
    const e = Math.pow(Math.min(1, Math.max(0, v)), 1.8);
    c.copy(BASE).lerp(T, e);
    if (v > 0.985) c.lerp(WHITE, ((v - 0.985) / 0.015) * 0.45);
    out[k * 3] = c.r;
    out[k * 3 + 1] = c.g;
    out[k * 3 + 2] = c.b;
  }
}

function Dots({ grid, values, tint, size, startLon, tilt, spin, rings }: Required<Pick<DotGlobeProps, "size" | "startLon" | "tilt" | "spin">> & Omit<DotGlobeProps, "className" | "size" | "startLon" | "tilt" | "spin"> & { grid: Grid }) {
  const group = useRef<THREE.Group>(null);
  const vel = useRef(0);
  const drag = useRef<{ x: number; on: boolean }>({ x: 0, on: false });
  const { gl } = useThree();
  const n = grid.n;

  const { geom, A, B, lonN } = useMemo(() => {
    const pos = new Float32Array(n * 3);
    const lonN = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const [x, y, z] = latLonToVec3(grid.lat(k), grid.lon(k), 1);
      pos[k * 3] = x;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = z;
      lonN[k] = (grid.lon(k) + 180) / 360;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const A = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    const B = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    colorsFor(n, null, tint, A.array as Float32Array);
    (B.array as Float32Array).set(A.array as Float32Array);
    g.setAttribute("colorA", A);
    g.setAttribute("colorB", B);
    g.setAttribute("lonN", new THREE.BufferAttribute(lonN, 1));
    return { geom: g, A, B, lonN };
  }, [grid]); // eslint-disable-line react-hooks/exhaustive-deps

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { t: { value: 1 }, size: { value: size * Math.min(2, window.devicePixelRatio || 1) } },
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // new layer: freeze what is on screen into A, put the new colours in B, sweep t from 0 to 1
  const anim = useRef({ t: 1 });
  useEffect(() => {
    const a = A.array as Float32Array;
    const b = B.array as Float32Array;
    const t = anim.current.t;
    if (t < 1) {
      const edge = t * 1.18 - 0.09;
      for (let k = 0; k < n; k++) {
        const x = Math.min(1, Math.max(0, (lonN[k] - (edge - 0.09)) / 0.09));
        const f = 1 - x * x * (3 - 2 * x);
        a[k * 3] += (b[k * 3] - a[k * 3]) * f;
        a[k * 3 + 1] += (b[k * 3 + 1] - a[k * 3 + 1]) * f;
        a[k * 3 + 2] += (b[k * 3 + 2] - a[k * 3 + 2]) * f;
      }
    } else a.set(b);
    colorsFor(n, values, tint, b);
    A.needsUpdate = true;
    B.needsUpdate = true;
    anim.current.t = 0;
  }, [values, tint]); // eslint-disable-line react-hooks/exhaustive-deps

  // drag to spin, with inertia; vertical moves are left to the page
  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "pan-y";
    const down = (e: PointerEvent) => {
      drag.current = { x: e.clientX, on: true };
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.on) return;
      const dx = e.clientX - drag.current.x;
      drag.current.x = e.clientX;
      vel.current = dx * 0.006;
      if (group.current) group.current.rotation.y += dx * 0.006;
    };
    const up = () => {
      drag.current.on = false;
      el.style.cursor = "grab";
    };
    el.style.cursor = "grab";
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl]);

  useEffect(() => {
    if (group.current) group.current.rotation.y = (-(startLon + 90) * Math.PI) / 180;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (!drag.current.on) {
      vel.current *= Math.pow(0.04, dt);
      g.rotation.y += dt * spin + vel.current;
    }
    if (anim.current.t < 1) {
      anim.current.t = Math.min(1, anim.current.t + dt / 1.6);
      mat.uniforms.t.value = anim.current.t;
    }
  });

  return (
    <group rotation={[tilt, 0, 0]}>
      <group ref={group}>
        <points geometry={geom} material={mat} />
        {rings?.map((r, i) => <Ring key={i} {...r} />)}
      </group>
      <mesh scale={1.035}>
        <sphereGeometry args={[1, 64, 48]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          uniforms={{ glow: { value: new THREE.Color(tint) } }}
          vertexShader={`varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
          fragmentShader={`uniform vec3 glow; varying vec3 vN; void main(){ float r = pow(1.0 - abs(vN.z), 6.0); gl_FragColor = vec4(glow, 1.0) * r * 0.32; }`}
        />
      </mesh>
    </group>
  );
}

function Ring({ lat, lon, color }: { lat: number; lon: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const [pos, quat] = useMemo(() => {
    const p = new THREE.Vector3(...latLonToVec3(lat, lon, 1.004));
    return [p, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize())];
  }, [lat, lon]);
  const offset = useMemo(() => Math.random() * 3, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = ((clock.elapsedTime + offset) % 3) / 3;
    ref.current.scale.setScalar(1 + t * 2.2);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.9;
  });
  return (
    <group position={pos} quaternion={quat}>
      <mesh>
        <circleGeometry args={[0.009, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={ref}>
        <ringGeometry args={[0.012, 0.016, 40]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function DotGlobe({ grid, values, tint, startLon = 40, tilt = 0.32, spin = 0.05, className, size = 2.2, rings }: DotGlobeProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div ref={wrap} className={className}>
      <Canvas frameloop={visible ? "always" : "never"} dpr={[1, 2]} camera={{ position: [0, 0, 3.15], fov: 38 }} gl={{ antialias: true, alpha: true }}>
        {grid && <Dots grid={grid} values={values} tint={tint} size={size} startLon={startLon} tilt={tilt} spin={reduced ? 0 : spin} rings={rings} />}
      </Canvas>
    </div>
  );
}
