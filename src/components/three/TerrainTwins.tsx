import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Body } from "../../data/sites";
import type { TerrainGrid } from "../../lib/terrain";
import { Orbit } from "./Controls";

export type Overlay = "relief" | "light";

interface Props {
  earth: TerrainGrid | null;
  target: TerrainGrid | null;
  litEarth: Float32Array | null;
  litTarget: Float32Array | null;
  footprintKm: number;
  sunElev: number; // true elevation, degrees
  sunAz: number; // degrees from north, clockwise
  playing: boolean;
  exaggeration: number;
  overlay: Overlay;
}

const SIZE = 10;
const GAP = 1.6;

const RAMP: Record<Body, string[]> = {
  earth: ["#2a2824", "#6f6450", "#b9a986", "#e6dcc6"],
  moon: ["#2e2d2b", "#6d6a64", "#a9a59c", "#e3dfd6"],
  mars: ["#3b1d14", "#7e3c22", "#b9673f", "#e7ae86"],
};

const SHADOW = new THREE.Color("#101a3a");
const SUN = new THREE.Color("#f2c879");

function rampColor(stops: THREE.Color[], t: number, out: THREE.Color) {
  const x = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  return out.copy(stops[i]).lerp(stops[i + 1], x - i);
}

function TerrainMesh({
  grid,
  lit,
  x,
  footprintKm,
  exaggeration,
  overlay,
}: {
  grid: TerrainGrid;
  lit: Float32Array | null;
  x: number;
  footprintKm: number;
  exaggeration: number;
  overlay: Overlay;
}) {
  const geo = useMemo(() => {
    const n = grid.n;
    const g = new THREE.PlaneGeometry(SIZE, SIZE, n - 1, n - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const unitsPerMetre = (SIZE / (footprintKm * 1000)) * exaggeration;
    for (let k = 0; k < n * n; k++) pos.setY(k, (grid.heights[k] - grid.min) * unitsPerMetre);
    g.computeVertexNormals();
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
    return g;
  }, [grid, footprintKm, exaggeration]);

  useEffect(() => {
    const n = grid.n;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const stops = RAMP[grid.body].map((c) => new THREE.Color(c));
    const c = new THREE.Color();
    const span = Math.max(1, grid.max - grid.min);
    for (let k = 0; k < n * n; k++) {
      if (overlay === "light" && lit) {
        const f = lit[k];
        c.copy(SHADOW).lerp(SUN, Math.pow(f, 0.7));
        if (f === 0) c.set("#0a1230"); // persistent shadow — never lit in a full turn
      } else {
        rampColor(stops, (grid.heights[k] - grid.min) / span, c);
      }
      col.setXYZ(k, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }, [geo, grid, lit, overlay]);

  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <mesh geometry={geo} position={[x, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  );
}

function SunLight({ sunElev, sunAz, playing, exaggeration }: { sunElev: number; sunAz: number; playing: boolean; exaggeration: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const az = useRef(sunAz);
  const { scene } = useThree();
  useEffect(() => {
    az.current = sunAz;
  }, [sunAz]);

  useEffect(() => {
    const l = light.current;
    if (!l) return;
    scene.add(l.target);
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    cam.left = -14;
    cam.right = 14;
    cam.top = 14;
    cam.bottom = -14;
    cam.near = 0.5;
    cam.far = 80;
    cam.updateProjectionMatrix();
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.04;
  }, [scene]);

  useFrame((_, dt) => {
    const l = light.current;
    if (!l) return;
    if (playing) az.current = (az.current + dt * 24) % 360;
    // Exaggerated relief needs a proportionally steeper Sun to cast true-length shadows.
    const e = Math.atan(Math.tan((Math.max(0.2, sunElev) * Math.PI) / 180) * exaggeration);
    const a = (az.current * Math.PI) / 180;
    l.position.set(Math.sin(a) * Math.cos(e) * 30, Math.sin(e) * 30, -Math.cos(a) * Math.cos(e) * 30);
    l.target.position.set(0, 0, 0);
  });

  return <directionalLight ref={light} castShadow intensity={3.1} color="#fff4e2" />;
}

export default function TerrainTwins(props: Props) {
  const { earth, target, litEarth, litTarget, footprintKm, exaggeration, overlay } = props;
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: typeof window !== "undefined" && window.innerWidth < 640 ? [0, 22, 30] : [0, 10.5, 15.5], fov: 38 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#07080a"]} />
      <fog attach="fog" args={["#07080a", 26, 48]} />
      <ambientLight intensity={0.07} />
      <hemisphereLight args={["#9fb3d9", "#2a2420", 0.12]} />
      <SunLight {...props} />
      {earth && <TerrainMesh grid={earth} lit={litEarth} x={-(SIZE + GAP) / 2} footprintKm={footprintKm} exaggeration={exaggeration} overlay={overlay} />}
      {target && <TerrainMesh grid={target} lit={litTarget} x={(SIZE + GAP) / 2} footprintKm={footprintKm} exaggeration={exaggeration} overlay={overlay} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[60, 40]} />
        <meshStandardMaterial color="#0b0c0f" roughness={1} />
      </mesh>
      <gridHelper args={[2 * SIZE + GAP + 6, 24, "#24252a", "#16171b"]} position={[0, -0.01, 0]} />
      <Orbit min={6} max={34} maxPolar={1.42} />
    </Canvas>
  );
}
