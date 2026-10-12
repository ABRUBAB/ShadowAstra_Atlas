import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Body } from "../../data/sites";
import { latLonToVec3 } from "../../lib/geo";
import { bestLod, useProgressiveTexture } from "./textures";

export const SUN_DIR = new THREE.Vector3(-0.85, 0.32, 0.55).normalize();

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
  /** Highest texture size to stream in after the 1K placeholder. */
  lod?: "1k" | "2k" | "4k";
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

// Day/night from real NASA mosaics. City lights only on the night side; a thin
// limb brightening instead of a neon rim.
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
    float dayMix = smoothstep(-0.08, 0.18, d);
    vec3 day = texture2D(dayMap, vUv).rgb;
    vec3 night = texture2D(nightMap, vUv).rgb;
    night = pow(night, vec3(1.8)) * vec3(1.0, 0.8, 0.55) * 2.2;
    vec3 lit = day * (0.16 + 1.2 * pow(max(d, 0.0), 0.75));
    vec3 col = mix(night, lit, dayMix);
    float fres = pow(1.0 - max(dot(n, vViewDir), 0.0), 3.4);
    col += vec3(0.55, 0.7, 0.95) * fres * 0.45 * smoothstep(-0.2, 0.4, d);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const atmoVertex = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vNormalW;
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const atmoFragment = /* glsl */ `
  uniform vec3 glow;
  uniform float strength;
  uniform vec3 sunDir;
  varying vec3 vNormalV;
  varying vec3 vNormalW;
  void main() {
    float rim = pow(max(0.66 - dot(vNormalV, vec3(0.0, 0.0, 1.0)), 0.0), 4.0);
    float sun = smoothstep(-0.35, 0.5, dot(normalize(vNormalW), normalize(sunDir)));
    gl_FragColor = vec4(glow, 1.0) * rim * strength * (0.15 + 0.85 * sun);
  }
`;

const ATMO: Partial<Record<Body, { color: string; strength: number }>> = {
  earth: { color: "#9cc0ff", strength: 1.9 },
  mars: { color: "#e5a27c", strength: 0.9 },
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
  lod,
}: PlanetProps) {
  const tiltRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const target = lod ?? bestLod();
  const day = useProgressiveTexture(body, target);
  const night = useProgressiveTexture(body === "earth" ? "night" : body, body === "earth" && target !== "1k" ? "2k" : "1k");

  const earthMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { dayMap: { value: day }, nightMap: { value: night }, sunDir: { value: SUN_DIR } },
        vertexShader: earthVertex,
        fragmentShader: earthFragment,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  earthMat.uniforms.dayMap.value = day;
  earthMat.uniforms.nightMap.value = night;

  const atmo = ATMO[body];
  const atmoMat = useMemo(
    () =>
      atmo &&
      new THREE.ShaderMaterial({
        uniforms: { glow: { value: new THREE.Color(atmo.color) }, strength: { value: atmo.strength }, sunDir: { value: SUN_DIR } },
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
    const k = Math.min(1, dt * 2.4);
    if (focus) {
      const targetY = (-(focus.lon + 90) * Math.PI) / 180;
      let diff = targetY - s.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      s.rotation.y += diff * k;
      t.rotation.x += ((focus.lat * Math.PI) / 180 - t.rotation.x) * k;
    } else {
      if (autoRotate) s.rotation.y += dt * spin;
      t.rotation.x += (tilt - t.rotation.x) * Math.min(1, dt * 1.5);
    }
  });

  return (
    <group ref={tiltRef}>
      <group ref={spinRef}>
        <mesh material={body === "earth" ? earthMat : undefined}>
          <sphereGeometry args={[radius, 128, 96]} />
          {body !== "earth" && <meshStandardMaterial map={day} roughness={1} metalness={0} />}
        </mesh>
        {markers.map((m) => (
          <Marker key={m.id} marker={m} radius={radius} active={m.id === activeId} onSelect={onSelect} />
        ))}
      </group>
      {atmosphere && atmoMat && (
        <mesh material={atmoMat} scale={1.055}>
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
}: {
  marker: GlobeMarker;
  radius: number;
  active: boolean;
  onSelect?: (id: string) => void;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const pos = useMemo(() => new THREE.Vector3(...latLonToVec3(marker.lat, marker.lon, radius * 1.003)), [marker, radius]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize()), [pos]);
  const color = useMemo(() => new THREE.Color(marker.color), [marker.color]);

  // Only the selected site breathes, everything else is still.
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const mat = ring.current.material as THREE.MeshBasicMaterial;
    if (!active) {
      ring.current.scale.setScalar(1);
      mat.opacity = marker.dim ? 0.15 : 0.55;
      return;
    }
    const t = (clock.elapsedTime % 2.8) / 2.8;
    const e = 1 - Math.pow(1 - t, 3);
    ring.current.scale.setScalar(1 + e * 2.4);
    mat.opacity = (1 - e) * 0.9;
  });

  const size = radius * (active ? 0.016 : hover ? 0.014 : 0.0105);
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
        <circleGeometry args={[radius * 0.04, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[size, 24]} />
        <meshBasicMaterial color={active ? "#ffffff" : color} transparent opacity={marker.dim ? 0.3 : 1} toneMapped={false} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[size * 1.5, size * 1.7, 48]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
