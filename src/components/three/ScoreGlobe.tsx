import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { latLonToVec3 } from "../../lib/geo";
import { Starfield } from "./Starfield";
import { bestLod, useProgressiveTexture } from "./textures";

export interface GlobePin {
  id: string;
  lat: number;
  lon: number;
  color: string;
  kind: "candidate" | "known" | "pick";
  rank?: number;
}

interface Props {
  heat: HTMLCanvasElement | null;
  /** Bump to re-upload the heat canvas. */
  heatVersion: number;
  heatOn?: boolean;
  pins: GlobePin[];
  activeId: string | null;
  focus: { lat: number; lon: number; key: number } | null;
  onPick: (lat: number, lon: number) => void;
  onHover?: (p: { lat: number; lon: number } | null) => void;
  onPin?: (id: string) => void;
}

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// A muted, always-lit Earth so the score colours read clearly on every side.
const fragment = /* glsl */ `
  uniform sampler2D day;
  uniform sampler2D heat;
  uniform float heatOn;
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vec3 c = texture2D(day, vUv).rgb;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, 0.5) * 0.58;
    float facing = max(vN.z, 0.0);
    c *= 0.5 + 0.6 * pow(facing, 0.6);
    vec4 h = texture2D(heat, vUv);
    c = mix(c, h.rgb, h.a * heatOn);
    c += vec3(0.55, 0.7, 0.95) * pow(1.0 - facing, 3.0) * 0.28;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

function toLatLon(p: THREE.Vector3) {
  const r = p.length();
  const lat = 90 - (Math.acos(THREE.MathUtils.clamp(p.y / r, -1, 1)) * 180) / Math.PI;
  let lon = (Math.atan2(p.z, -p.x) * 180) / Math.PI - 180;
  if (lon < -180) lon += 360;
  return { lat, lon };
}

function Earth({ heat, heatVersion, heatOn = true, onPick, onHover }: Pick<Props, "heat" | "heatVersion" | "heatOn" | "onPick" | "onHover">) {
  const day = useProgressiveTexture("earth", bestLod() === "4k" ? "4k" : "2k");
  const heatTex = useMemo(() => {
    const t = new THREE.CanvasTexture(heat ?? document.createElement("canvas"));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [heat]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { day: { value: day }, heat: { value: heatTex }, heatOn: { value: 1 } },
        vertexShader: vertex,
        fragmentShader: fragment,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  mat.uniforms.day.value = day;
  mat.uniforms.heat.value = heatTex;
  useEffect(() => {
    heatTex.needsUpdate = true;
  }, [heatTex, heatVersion]);
  useFrame((_, dt) => {
    const u = mat.uniforms.heatOn;
    u.value += ((heatOn ? 1 : 0) - u.value) * Math.min(1, dt * 5);
  });

  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <mesh
      material={mat}
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        const d = down.current;
        down.current = null;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
        e.stopPropagation();
        const { lat, lon } = toLatLon(e.point);
        onPick(lat, lon);
      }}
      onPointerMove={(e) => {
        if (!onHover) return;
        onHover(toLatLon(e.point));
        document.body.style.cursor = "crosshair";
      }}
      onPointerOut={() => {
        onHover?.(null);
        document.body.style.cursor = "";
      }}
    >
      <sphereGeometry args={[1, 160, 120]} />
    </mesh>
  );
}

const labelCache = new Map<string, THREE.CanvasTexture>();
function rankTexture(n: number, color: string) {
  const key = `${n}|${color}`;
  let t = labelCache.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  x.beginPath();
  x.arc(64, 64, 46, 0, Math.PI * 2);
  x.fillStyle = "rgba(7,8,10,0.86)";
  x.fill();
  x.lineWidth = 6;
  x.strokeStyle = color;
  x.stroke();
  x.fillStyle = "#edeae4";
  x.font = "600 54px Geist, system-ui, sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(String(n), 64, 68);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  labelCache.set(key, t);
  return t;
}

function Pin({ pin, active, onPin }: { pin: GlobePin; active: boolean; onPin?: (id: string) => void }) {
  const ring = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => new THREE.Vector3(...latLonToVec3(pin.lat, pin.lon, 1.004)), [pin.lat, pin.lon]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize()), [pos]);
  const color = useMemo(() => new THREE.Color(pin.color), [pin.color]);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const m = ring.current.material as THREE.MeshBasicMaterial;
    if (!active) {
      ring.current.scale.setScalar(1);
      m.opacity = pin.kind === "known" ? 0.7 : 0.5;
      return;
    }
    const t = (clock.elapsedTime % 2.4) / 2.4;
    const e = 1 - Math.pow(1 - t, 3);
    ring.current.scale.setScalar(1 + e * 2.6);
    m.opacity = (1 - e) * 0.95;
  });
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onPin?.(pin.id);
  };
  if (pin.kind === "candidate" && pin.rank) {
    return (
      <group position={pos.clone().multiplyScalar(1.012)}>
        <sprite scale={active ? 0.085 : 0.062} onClick={click} renderOrder={5}>
          <spriteMaterial map={rankTexture(pin.rank, pin.color)} transparent depthWrite={false} />
        </sprite>
        <group quaternion={quat}>
          <mesh ref={ring}>
            <ringGeometry args={[0.022, 0.026, 48]} />
            <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      </group>
    );
  }
  const size = pin.kind === "pick" ? 0.014 : 0.008;
  return (
    <group position={pos} quaternion={quat} onClick={click}>
      <mesh>
        <circleGeometry args={[size, 24]} />
        <meshBasicMaterial color={pin.kind === "known" ? "#07080a" : color} toneMapped={false} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[size * (pin.kind === "known" ? 0.8 : 1.4), size * (pin.kind === "known" ? 1.25 : 1.7), 40]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Orbit controls with idle auto-spin and a smooth fly-to for a chosen point. */
function Rig({ focus }: { focus: Props["focus"] }) {
  const { camera, gl } = useThree();
  const ctl = useRef<OrbitControls | null>(null);
  const fly = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number; d0: number; d1: number } | null>(null);
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.rotateSpeed = 0.45;
    c.zoomSpeed = 0.6;
    c.enablePan = false;
    c.minDistance = 1.35;
    c.maxDistance = 5;
    c.autoRotate = true;
    c.autoRotateSpeed = 0.35;
    const stop = () => (c.autoRotate = false);
    c.addEventListener("start", stop);
    ctl.current = c;
    return () => {
      c.removeEventListener("start", stop);
      c.dispose();
    };
  }, [camera, gl]);
  useEffect(() => {
    if (!focus) return;
    const c = ctl.current;
    if (c) c.autoRotate = false;
    const d0 = camera.position.length();
    fly.current = {
      from: camera.position.clone().normalize(),
      to: new THREE.Vector3(...latLonToVec3(focus.lat, focus.lon, 1)).normalize(),
      t: 0,
      d0,
      d1: Math.min(d0, 2.5),
    };
  }, [focus, camera]);
  useFrame((_, dt) => {
    const f = fly.current;
    if (f) {
      f.t = Math.min(1, f.t + dt / 1.1);
      const e = 1 - Math.pow(1 - f.t, 3);
      const dir = f.from.clone().lerp(f.to, e).normalize();
      // keep a little latitude bias so the point sits in view rather than dead centre
      camera.position.copy(dir.multiplyScalar(f.d0 + (f.d1 - f.d0) * e));
      camera.lookAt(0, 0, 0);
      if (f.t >= 1) fly.current = null;
    }
    ctl.current?.update();
  });
  return null;
}

export default function ScoreGlobe(p: Props) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.9, 2.9], fov: 40 }} aria-label="Earth globe coloured by match score">
      <color attach="background" args={["#07080a"]} />
      <Starfield count={1400} />
      <Suspense fallback={null}>
        <Earth heat={p.heat} heatVersion={p.heatVersion} heatOn={p.heatOn} onPick={p.onPick} onHover={p.onHover} />
        {p.pins.map((pin) => (
          <Pin key={pin.id} pin={pin} active={pin.id === p.activeId} onPin={p.onPin} />
        ))}
      </Suspense>
      <Rig focus={p.focus} />
    </Canvas>
  );
}
