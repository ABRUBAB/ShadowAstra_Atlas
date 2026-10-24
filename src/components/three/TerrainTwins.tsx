import { Scene } from "../ui/Safe";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Body } from "../../data/sites";
import type { TerrainGrid } from "../../lib/terrain";
import { Orbit } from "./Controls";

export type Overlay = "imagery" | "light" | "relief";

interface Props {
  earth: TerrainGrid | null;
  target: TerrainGrid | null;
  drapeEarth: HTMLCanvasElement | null;
  drapeTarget: HTMLCanvasElement | null;
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
const GAP = 2.2;
const BASE = 0.9; // slab thickness below the lowest point

const RAMP: Record<Body, string[]> = {
  earth: ["#2a2824", "#6f6450", "#b9a986", "#e6dcc6"],
  moon: ["#2e2d2b", "#6d6a64", "#a9a59c", "#e3dfd6"],
  mars: ["#3b1d14", "#7e3c22", "#b9673f", "#e7ae86"],
};
const WALL_TOP: Record<Body, string> = { earth: "#6b5a46", moon: "#5c5a55", mars: "#6e3824" };

const SHADOW = new THREE.Color("#101a3a");
const SUN = new THREE.Color("#f2c879");

function rampColor(stops: THREE.Color[], t: number, out: THREE.Color) {
  const x = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  return out.copy(stops[i]).lerp(stops[i + 1], x - i);
}

/** Four vertical walls from the terrain edge down to a flat base, a cut sample. */
function buildWalls(grid: TerrainGrid, yOf: (k: number) => number) {
  const n = grid.n;
  const pos: number[] = [];
  const col: number[] = [];
  const top = new THREE.Color(WALL_TOP[grid.body]);
  const bottom = new THREE.Color("#0b0c0f");
  const half = SIZE / 2;
  const xy = (i: number) => -half + (i / (n - 1)) * SIZE;
  const edges: [number, number][][] = [
    Array.from({ length: n }, (_, i) => [i, 0]),
    Array.from({ length: n }, (_, i) => [n - 1, i]),
    Array.from({ length: n }, (_, i) => [n - 1 - i, n - 1]),
    Array.from({ length: n }, (_, i) => [0, n - 1 - i]),
  ];
  for (const edge of edges) {
    for (let s = 0; s < edge.length - 1; s++) {
      const [i0, j0] = edge[s];
      const [i1, j1] = edge[s + 1];
      const a = [xy(i0), yOf(j0 * n + i0), xy(j0)];
      const b = [xy(i1), yOf(j1 * n + i1), xy(j1)];
      const a0 = [a[0], -BASE, a[2]];
      const b0 = [b[0], -BASE, b[2]];
      pos.push(...a, ...a0, ...b, ...b, ...a0, ...b0);
      for (const isTop of [1, 0, 1, 1, 0, 0]) {
        const c = isTop ? top : bottom;
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function TerrainSlab({
  grid,
  drape,
  lit,
  x,
  footprintKm,
  exaggeration,
  overlay,
}: {
  grid: TerrainGrid;
  drape: HTMLCanvasElement | null;
  lit: Float32Array | null;
  x: number;
  footprintKm: number;
  exaggeration: number;
  overlay: Overlay;
}) {
  const unitsPerMetre = (SIZE / (footprintKm * 1000)) * exaggeration;
  const yOf = (k: number) => (grid.heights[k] - grid.min) * unitsPerMetre;

  const surface = useMemo(() => {
    const n = grid.n;
    const g = new THREE.PlaneGeometry(SIZE, SIZE, n - 1, n - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < n * n; k++) pos.setY(k, yOf(k));
    g.computeVertexNormals();
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, footprintKm, exaggeration]);

  const walls = useMemo(() => buildWalls(grid, yOf), [grid, footprintKm, exaggeration]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slice marker: the W–E line used for the cross-section chart.
  const slice = useMemo(() => {
    const n = grid.n;
    const row = Math.floor(n / 2);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) pts.push(new THREE.Vector3(-SIZE / 2 + (i / (n - 1)) * SIZE, yOf(row * n + i) + 0.04, -SIZE / 2 + (row / (n - 1)) * SIZE));
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: "#f2c879", transparent: true, opacity: 0.9 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, footprintKm, exaggeration]);

  const texture = useMemo(() => {
    if (!drape) return null;
    const t = new THREE.CanvasTexture(drape);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [drape]);

  useEffect(() => {
    const n = grid.n;
    const colAttr = surface.attributes.color as THREE.BufferAttribute;
    const stops = RAMP[grid.body].map((c) => new THREE.Color(c));
    const c = new THREE.Color();
    const span = Math.max(1, grid.max - grid.min);
    for (let k = 0; k < n * n; k++) {
      if (overlay === "light" && lit) {
        const f = lit[k];
        if (f === 0) c.set("#0a1230");
        else c.copy(SHADOW).lerp(SUN, Math.pow(f, 0.7));
      } else rampColor(stops, (grid.heights[k] - grid.min) / span, c);
      colAttr.setXYZ(k, c.r, c.g, c.b);
    }
    colAttr.needsUpdate = true;
  }, [surface, grid, lit, overlay]);

  useEffect(() => () => surface.dispose(), [surface]);
  useEffect(() => () => walls.dispose(), [walls]);
  useEffect(() => () => texture?.dispose(), [texture]);

  const useImage = overlay === "imagery" && texture;
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={surface} castShadow receiveShadow>
        {useImage ? (
          <meshStandardMaterial key="img" map={texture} roughness={0.95} metalness={0} />
        ) : (
          <meshStandardMaterial key="vc" vertexColors roughness={0.95} metalness={0} />
        )}
      </mesh>
      <mesh geometry={walls} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <primitive object={slice} />
    </group>
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
    Object.assign(cam, { left: -15, right: 15, top: 15, bottom: -15, near: 0.5, far: 90 });
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
    l.position.set(Math.sin(a) * Math.cos(e) * 34, Math.sin(e) * 34, -Math.cos(a) * Math.cos(e) * 34);
  });

  return <directionalLight ref={light} castShadow intensity={2.8} color="#fff4e2" />;
}

export default function TerrainTwins(props: Props) {
  const { earth, target, drapeEarth, drapeTarget, litEarth, litTarget, footprintKm, exaggeration, overlay } = props;
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;
  return (
    <Scene
      fallback={
        <div className="grid h-full place-items-center p-6 text-center">
          <p className="max-w-sm text-[13px] leading-relaxed text-chrome">The 3D ground needs WebGL, which this browser has turned off. The maps, the slice profile and the slope numbers on this page still work.</p>
        </div>
      }
    >
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: narrow ? [0, 22, 30] : [0, 9.5, 17], fov: 36 }} gl={{ antialias: true }}>
      <color attach="background" args={["#0b0c0f"]} />
      <fog attach="fog" args={["#0b0c0f", 30, 55]} />
      <ambientLight intensity={overlay === "imagery" ? 0.35 : 0.08} />
      <hemisphereLight args={["#c9d6f0", "#2a2420", overlay === "imagery" ? 0.35 : 0.12]} />
      <SunLight {...props} />
      {earth && <TerrainSlab grid={earth} drape={drapeEarth} lit={litEarth} x={-(SIZE + GAP) / 2} footprintKm={footprintKm} exaggeration={exaggeration} overlay={overlay} />}
      {target && <TerrainSlab grid={target} drape={drapeTarget} lit={litTarget} x={(SIZE + GAP) / 2} footprintKm={footprintKm} exaggeration={exaggeration} overlay={overlay} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -BASE - 0.01, 0]} receiveShadow>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color="#0b0c0f" roughness={1} />
      </mesh>
      <Orbit min={7} max={36} maxPolar={1.45} />
    </Canvas>
    </Scene>
  );
}
