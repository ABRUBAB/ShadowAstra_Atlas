import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Body } from "../../data/sites";
import { latLonToVec3 } from "../../lib/geo";

// Phones get the 2K mosaics (same NASA sources, downsampled) to keep loading fast.
const RES = typeof window !== "undefined" && window.innerWidth < 900 ? "2k" : "4k";
export const TEXTURES: Record<Body, string> = {
  earth: `/textures/earth_day_${RES}.jpg`,
  moon: `/textures/moon_lroc_${RES}.jpg`,
  mars: `/textures/mars_viking_${RES}.jpg`,
};
const NIGHT = `/textures/earth_night_${RES}.jpg`;

export const SUN_DIR = new THREE.Vector3(-0.85, 0.35, 0.6).normalize();

export interface GlobeMarker {
  id: string;
  lat: number;
  lon: number;
  color: string;
  label?: string;
  dim?: boolean;
}

interface PlanetProps {
  body: Body;
  radius?: number;
  markers?: GlobeMarker[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  /** Rotate so this point faces the camera. */
  focus?: { lat: number; lon: number } | null;
  autoRotate?: boolean;
  spin?: number;
  tilt?: number;
  atmosphere?: boolean;
}

const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const earthFragment = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunDir;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vec3 n = normalize(vNormalW);
    float d = dot(n, normalize(sunDir));
    float dayMix = smoothstep(-0.12, 0.22, d);
    vec3 day = texture2D(dayMap, vUv).rgb;
    vec3 night = texture2D(nightMap, vUv).rgb;
    night = pow(night, vec3(1.6)) * vec3(1.0, 0.78, 0.5) * 2.4;
    vec3 lit = day * (0.18 + 1.05 * max(d, 0.0));
    vec3 col = mix(night, lit, dayMix);
    float fres = pow(1.0 - max(dot(n, vViewDir), 0.0), 2.6);
    col += vec3(0.32, 0.58, 1.0) * fres * (0.75 * dayMix + 0.08);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const atmoVertex = /* glsl */ `
  varying vec3 vNormalV;
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const atmoFragment = /* glsl */ `
  uniform vec3 glow;
  uniform float strength;
  varying vec3 vNormalV;
  void main() {
    float i = pow(max(0.68 - dot(vNormalV, vec3(0.0, 0.0, 1.0)), 0.0), 4.0) * strength;
    gl_FragColor = vec4(glow, 1.0) * i;
  }
`;

const ATMO: Partial<Record<Body, { color: string; strength: number }>> = {
  earth: { color: "#5aa8ff", strength: 2.2 },
  mars: { color: "#e0895c", strength: 1.1 },
  moon: { color: "#c9d2e0", strength: 0.35 },
};

export function Planet({
  body,
  radius = 1,
  markers = [],
  activeId,
  onSelect,
  focus,
  autoRotate = true,
  spin = 0.05,
  tilt = 0,
  atmosphere = true,
}: PlanetProps) {
  const tiltRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [day, night] = useTexture(body === "earth" ? [TEXTURES.earth, NIGHT] : [TEXTURES[body], TEXTURES[body]]);

  useMemo(() => {
    for (const t of [day, night]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
    }
  }, [day, night]);

  const earthMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { dayMap: { value: day }, nightMap: { value: night }, sunDir: { value: SUN_DIR } },
        vertexShader: earthVertex,
        fragmentShader: earthFragment,
      }),
    [day, night],
  );

  const atmo = ATMO[body];
  const atmoMat = useMemo(
    () =>
      atmo &&
      new THREE.ShaderMaterial({
        uniforms: { glow: { value: new THREE.Color(atmo.color) }, strength: { value: atmo.strength } },
        vertexShader: atmoVertex,
        fragmentShader: atmoFragment,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [atmo],
  );

  useFrame((_, dt) => {
    const s = spinRef.current;
    const t = tiltRef.current;
    if (!s || !t) return;
    if (focus) {
      const targetY = (-(focus.lon + 90) * Math.PI) / 180;
      // shortest path around the circle
      let diff = targetY - s.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      s.rotation.y += diff * Math.min(1, dt * 3);
      const targetX = (focus.lat * Math.PI) / 180;
      t.rotation.x += (targetX - t.rotation.x) * Math.min(1, dt * 3);
    } else {
      if (autoRotate) s.rotation.y += dt * spin;
      t.rotation.x += (tilt - t.rotation.x) * Math.min(1, dt * 2);
    }
  });

  return (
    <group ref={tiltRef}>
      <group ref={spinRef}>
        <mesh ref={meshRef} material={body === "earth" ? earthMat : undefined}>
          <sphereGeometry args={[radius, 128, 96]} />
          {body !== "earth" && <meshStandardMaterial map={day} roughness={1} metalness={0} />}
        </mesh>
        {markers.map((m) => (
          <Marker
            key={m.id}
            marker={m}
            radius={radius}
            active={m.id === activeId}
            onSelect={onSelect}
            occluder={meshRef}
          />
        ))}
      </group>
      {atmosphere && atmoMat && (
        <mesh material={atmoMat} scale={1.06}>
          <sphereGeometry args={[radius, 64, 48]} />
        </mesh>
      )}
    </group>
  );
}

function Marker({
  marker,
  radius,
  active,
  onSelect,
  occluder,
}: {
  marker: GlobeMarker;
  radius: number;
  active: boolean;
  onSelect?: (id: string) => void;
  occluder: React.RefObject<THREE.Mesh | null>;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const pos = useMemo(() => new THREE.Vector3(...latLonToVec3(marker.lat, marker.lon, radius * 1.004)), [marker, radius]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize()), [pos]);
  const offset = useMemo(() => Math.random() * 3, []);
  const color = useMemo(() => new THREE.Color(marker.color), [marker.color]);

  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = ((clock.elapsedTime + offset) % 2.4) / 2.4;
    const s = 1 + t * (active ? 3.2 : 2.2);
    ring.current.scale.setScalar(s);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * (marker.dim ? 0.2 : 0.85);
  });

  const size = radius * (active ? 0.018 : 0.012);
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect?.(marker.id);
  };

  return (
    <group position={pos} quaternion={quat}>
      <mesh
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <circleGeometry args={[size * 2.6, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[size, 24]} />
        <meshBasicMaterial color={color} transparent opacity={marker.dim ? 0.35 : 1} toneMapped={false} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[size * 1.15, size * 1.35, 40]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {(active || hover) && marker.label && (
        <Html
          center
          occlude={[occluder as React.RefObject<THREE.Object3D>]}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none", transform: "translate(0, -26px)" }}
        >
          <div className="whitespace-nowrap rounded-md border border-line-2 bg-ink/90 px-2 py-1 text-[11px] font-medium text-platinum">
            {marker.label}
          </div>
        </Html>
      )}
    </group>
  );
}
