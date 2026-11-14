import { Scene } from "../ui/Safe";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Body } from "../../data/sites";
import type { TerrainGrid } from "../../lib/terrain";
import type { RoutePoint, TeamMode } from "../../lib/fieldtest";
import { ctrlWheelZoom } from "../../lib/wheel";
import { AdaptiveDpr, createOrbit, ReleaseGPU } from "./Controls";

export type Overlay = "imagery" | "light" | "relief";

/** A field test drawn on both blocks: each side's route, its shadows and the team, moving in sync. */
export interface FieldScene {
  /** 0 to 1 along the route. Read every frame, so the run moves without React renders. */
  progress: { current: number };
  mode: TeamMode;
  earth: { route: RoutePoint[]; shade: Uint8Array };
  target: { route: RoutePoint[]; shade: Uint8Array };
}

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
  field?: FieldScene | null;
  /** Full-screen view: there is no page to scroll, so the plain mouse wheel zooms. */
  fullScreen?: boolean;
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

// field test route colours: sunlit and drivable, steeper than the limit, in shadow
const ROUTE_OK = new THREE.Color("#f2c879");
const ROUTE_OVER = new THREE.Color("#e47a63");
const ROUTE_SHADE = new THREE.Color("#8d9ab8");

/** Slab-local x of grid column i and z of grid row j (row 0 = north = far side). */
const colX = (i: number, n: number) => -SIZE / 2 + (i / (n - 1)) * SIZE;
const rowZ = (j: number, n: number) => -SIZE / 2 + (j / (n - 1)) * SIZE;

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

interface SlabField {
  route: RoutePoint[];
  shade: Uint8Array;
  mode: TeamMode;
  progress: { current: number };
}

function TerrainSlab({
  grid,
  drape,
  lit,
  x,
  footprintKm,
  exaggeration,
  overlay,
  field,
}: {
  grid: TerrainGrid;
  drape: HTMLCanvasElement | null;
  lit: Float32Array | null;
  x: number;
  footprintKm: number;
  exaggeration: number;
  overlay: Overlay;
  field: SlabField | null;
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
  // a primitive is not disposed by React Three Fiber, so free the slice line's buffers here
  useEffect(
    () => () => {
      slice.geometry.dispose();
      (slice.material as THREE.Material).dispose();
    },
    [slice],
  );

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
      {field ? (
        <>
          <ShadeOverlay surface={surface} shade={field.shade} n={grid.n} />
          <RouteRibbon grid={grid} route={field.route} upm={unitsPerMetre} progress={field.progress} />
          <TeamMarker grid={grid} route={field.route} upm={unitsPerMetre} progress={field.progress} mode={field.mode} />
        </>
      ) : (
        <primitive object={slice} />
      )}
    </group>
  );
}

/* ------------------------------------------------------------ field test */

/** Ground in shadow for this side's own Sun, as a dark veil over the surface (works over imagery too). */
function ShadeOverlay({ surface, shade, n }: { surface: THREE.BufferGeometry; shade: Uint8Array; n: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", (surface.attributes.position as THREE.BufferAttribute).clone());
    if (surface.index) g.setIndex(surface.index.clone());
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * n * 4), 4));
    return g;
  }, [surface, n]);
  useEffect(() => {
    const c = geo.attributes.color as THREE.BufferAttribute;
    for (let k = 0; k < n * n; k++) c.setXYZW(k, 0.012, 0.018, 0.045, shade[k] ? 0.66 : 0);
    c.needsUpdate = true;
  }, [geo, shade, n]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} renderOrder={1}>
      <meshBasicMaterial vertexColors transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
    </mesh>
  );
}

/** A flat ribbon laid along the route, coloured by what the team meets at each step. */
function ribbonGeometry(grid: TerrainGrid, route: RoutePoint[], upm: number) {
  const n = grid.n;
  const cell = SIZE / (n - 1);
  const w = Math.min(0.09, cell * 0.9);
  const t = w / cell;
  const lift = 0.045;
  const h = (i: number, j: number) => grid.heights[Math.max(0, Math.min(n - 1, j)) * n + i];
  const pos = new Float32Array(route.length * 6);
  const col = new Float32Array(route.length * 6);
  const idx: number[] = [];
  route.forEach((p, k) => {
    const x = colX(p.i, n);
    const z = rowZ(p.j, n);
    // the ribbon's edges follow the ground a little north and south of the route
    const yN = (h(p.i, p.j) * (1 - t) + h(p.i, p.j - 1) * t - grid.min) * upm + lift;
    const yS = (h(p.i, p.j) * (1 - t) + h(p.i, p.j + 1) * t - grid.min) * upm + lift;
    pos.set([x, yN, z - w, x, yS, z + w], k * 6);
    const c = p.over ? ROUTE_OVER : p.shadow ? ROUTE_SHADE : ROUTE_OK;
    col.set([c.r, c.g, c.b, c.r, c.g, c.b], k * 6);
    if (k > 0) {
      const a = (k - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** The planned route, faint, and the part already travelled, bright. */
function RouteRibbon({ grid, route, upm, progress }: { grid: TerrainGrid; route: RoutePoint[]; upm: number; progress: { current: number } }) {
  const planned = useMemo(() => ribbonGeometry(grid, route, upm), [grid, route, upm]);
  const trail = useMemo(() => planned.clone(), [planned]);
  useEffect(
    () => () => {
      planned.dispose();
      trail.dispose();
    },
    [planned, trail],
  );
  useFrame(() => {
    trail.setDrawRange(0, Math.round(progress.current * (route.length - 1)) * 6);
  });
  return (
    <>
      <mesh geometry={planned} renderOrder={2}>
        <meshBasicMaterial vertexColors transparent opacity={0.32} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <mesh geometry={trail} renderOrder={3}>
        <meshBasicMaterial vertexColors transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
    </>
  );
}

const SUIT = "#e9e4da";

function Rover() {
  return (
    <group>
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.5, 0.1, 0.3]} />
        <meshStandardMaterial color={SUIT} roughness={0.55} metalness={0.15} />
      </mesh>
      {[
        [-0.17, 0.18],
        [0.17, 0.18],
        [-0.17, -0.18],
        [0.17, -0.18],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.075, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.06, 16]} />
          <meshStandardMaterial color="#2a2b30" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0.16, 0.28, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
        <meshStandardMaterial color="#a8a59e" roughness={0.6} />
      </mesh>
      <mesh position={[0.16, 0.37, 0]}>
        <sphereGeometry args={[0.035, 14, 10]} />
        <meshBasicMaterial color="#f2c879" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Walkers() {
  return (
    <group>
      {[
        [0.05, 0.09],
        [-0.07, -0.09],
      ].map(([x, z]) => (
        <group key={`${x}:${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.15, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.17, 6, 12]} />
            <meshStandardMaterial color={SUIT} roughness={0.6} />
          </mesh>
          <mesh position={[-0.05, 0.17, 0]}>
            <boxGeometry args={[0.05, 0.12, 0.09]} />
            <meshStandardMaterial color="#a8a59e" roughness={0.8} />
          </mesh>
          <mesh position={[0.045, 0.25, 0]}>
            <sphereGeometry args={[0.022, 10, 8]} />
            <meshBasicMaterial color="#f2c879" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The team: a small rover or two walkers, with a thin ring that stays visible behind hills. */
function TeamMarker({ grid, route, upm, progress, mode }: { grid: TerrainGrid; route: RoutePoint[]; upm: number; progress: { current: number }; mode: TeamMode }) {
  const ref = useRef<THREE.Group>(null);
  const n = grid.n;
  useFrame(() => {
    const g = ref.current;
    if (!g || route.length < 2) return;
    const last = route.length - 1;
    const f = Math.min(last, Math.max(0, progress.current * last));
    const k0 = Math.floor(f);
    const k1 = Math.min(last, k0 + 1);
    const t = f - k0;
    const y = (m: number) => (m - grid.min) * upm;
    const a = route[k0];
    const b = route[k1];
    g.position.set(colX(a.i, n) + (colX(b.i, n) - colX(a.i, n)) * t, y(a.height) + (y(b.height) - y(a.height)) * t, rowZ(a.j, n));
    // tilt with the ground as drawn (relief exaggeration included)
    const ka = Math.max(0, k0 - 1);
    const kb = Math.min(last, k0 + 2);
    g.rotation.z = Math.atan2(y(route[kb].height) - y(route[ka].height), colX(route[kb].i, n) - colX(route[ka].i, n));
  });
  return (
    <group ref={ref}>
      {mode === "rover" ? <Rover /> : <Walkers />}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <ringGeometry args={[0.32, 0.36, 48]} />
        <meshBasicMaterial color="#f2c879" transparent opacity={0.6} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ----------------------------------------------------------------- stage */

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

/** Fill of the canvas the two blocks may use; a little over 1 lets only the nearest corners touch the edge. */
const FIT_FILL = 1.06;

/**
 * Camera distance at which both blocks fit a canvas of this size, keeping the current viewing
 * direction: what FitSphere does for globes, done for this wide two-block stage (a sphere around
 * it would leave wide screens mostly empty).
 */
function fitDistance(camera: THREE.PerspectiveCamera, width: number, height: number, top: number) {
  if (!camera.isPerspectiveCamera || !width || !height) return 0;
  const cam = camera.clone();
  cam.aspect = width / height;
  cam.updateProjectionMatrix();
  const hx = SIZE + GAP / 2;
  const corners: THREE.Vector3[] = [];
  for (const x of [-hx, hx]) for (const y of [-BASE, top]) for (const z of [-SIZE / 2, SIZE / 2]) corners.push(new THREE.Vector3(x, y, z));
  const dir = camera.position.clone().normalize();
  const v = new THREE.Vector3();
  const fits = (d: number) => {
    cam.position.copy(dir).multiplyScalar(d);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    return corners.every((c) => {
      v.copy(c).project(cam);
      return Math.abs(v.x) <= FIT_FILL && Math.abs(v.y) <= FIT_FILL;
    });
  };
  let lo = 4;
  let hi = 240;
  for (let k = 0; k < 26; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * Orbit controls for the stage (same settings and wheel policy as `Orbit`), plus the fit: whenever
 * the canvas changes size (a phone, a resized window, full screen) the camera moves so both blocks fit.
 */
function StageOrbit({ top, wheel }: { top: number; wheel: "ctrl" | "zoom" }) {
  const { camera, gl, size, scene } = useThree();
  const ctl = useRef<ReturnType<typeof createOrbit> | null>(null);
  useEffect(() => {
    const c = createOrbit(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.rotateSpeed = 0.5;
    c.zoomSpeed = 0.6;
    c.enablePan = false;
    c.minDistance = 7;
    c.maxDistance = 36;
    c.maxPolarAngle = 1.45;
    c.target.set(0, 0, 0);
    ctl.current = c;
    // in the page the wheel scrolls (Ctrl or ⌘ + wheel zooms); full screen zooms on a plain wheel
    const off = wheel === "ctrl" ? ctrlWheelZoom(gl.domElement, (on) => (c.enableZoom = on)) : null;
    return () => {
      off?.();
      c.dispose();
      ctl.current = null;
    };
  }, [camera, gl, wheel]);
  useEffect(() => {
    const d = fitDistance(camera as THREE.PerspectiveCamera, size.width, size.height, top);
    if (!d) return;
    const c = ctl.current;
    if (c) c.maxDistance = Math.max(36, d * 1.35);
    camera.position.setLength(d);
    c?.update();
  }, [camera, size.width, size.height, top, wheel]);
  useFrame(() => {
    ctl.current?.update();
    // the fog hides the edge of the ground plane; it keeps the same depth behind the blocks at any distance
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      const d = camera.position.length();
      fog.near = d + 10.5;
      fog.far = d + 35.5;
    }
  });
  return null;
}

export default function TerrainTwins(props: Props) {
  const { earth, target, drapeEarth, drapeTarget, litEarth, litTarget, footprintKm, exaggeration, overlay, field, fullScreen } = props;
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;
  const upm = (SIZE / (footprintKm * 1000)) * exaggeration;
  const top = Math.max(earth ? earth.max - earth.min : 0, target ? target.max - target.min : 0) * upm;
  const sideE = useMemo(() => (field ? { route: field.earth.route, shade: field.earth.shade, mode: field.mode, progress: field.progress } : null), [field]);
  const sideT = useMemo(() => (field ? { route: field.target.route, shade: field.target.shade, mode: field.mode, progress: field.progress } : null), [field]);
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
      {earth && <TerrainSlab grid={earth} drape={drapeEarth} lit={litEarth} x={-(SIZE + GAP) / 2} footprintKm={footprintKm} exaggeration={exaggeration} overlay={overlay} field={sideE} />}
      {target && <TerrainSlab grid={target} drape={drapeTarget} lit={litTarget} x={(SIZE + GAP) / 2} footprintKm={footprintKm} exaggeration={exaggeration} overlay={overlay} field={sideT} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -BASE - 0.01, 0]} receiveShadow>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color="#0b0c0f" roughness={1} />
      </mesh>
      <StageOrbit top={top} wheel={fullScreen ? "zoom" : "ctrl"} />
      <ReleaseGPU />
      <AdaptiveDpr />
    </Canvas>
    </Scene>
  );
}
