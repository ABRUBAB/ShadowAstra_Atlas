import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ctrlWheelZoom } from "../../lib/wheel";
import { SOFTWARE_GL, enableLiteGraphics } from "../ui/Safe";

/**
 * OrbitControls that let go of the page when disposed. three r186 adds a keydown listener to
 * `canvas.getRootNode()` (the document) but removes it from `getRootNode()` at dispose time, when
 * React has already detached the canvas, so the call misses and the listener kept every visited
 * page's canvas, scene and DOM alive (about 0.45 MB per visit to Maps, found with heap snapshots).
 */
export function createOrbit(camera: THREE.Camera, el: HTMLElement) {
  const c = new OrbitControls(camera, el);
  const root = el.getRootNode();
  const dispose = c.dispose.bind(c);
  c.dispose = () => {
    dispose();
    const h = c as unknown as { _interceptControlDown: EventListener; _interceptControlUp: EventListener };
    root.removeEventListener("keydown", h._interceptControlDown, { capture: true });
    root.removeEventListener("keyup", h._interceptControlUp, { capture: true });
  };
  return c;
}

/** Thin OrbitControls wrapper (avoids pulling in a whole helper library). Updated inside the R3F frame loop. */
export function Orbit({
  min = 1.6,
  max = 9,
  pan = false,
  target = [0, 0, 0],
  maxPolar,
  wheel = "ctrl",
}: {
  min?: number;
  max?: number;
  pan?: boolean;
  target?: [number, number, number];
  maxPolar?: number;
  /** "ctrl" (default): the wheel scrolls the page and Ctrl or ⌘ + wheel zooms. "zoom": a full-screen view. */
  wheel?: "ctrl" | "zoom";
}) {
  const { camera, gl } = useThree();
  const ctl = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const c = createOrbit(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.rotateSpeed = 0.5;
    c.zoomSpeed = 0.6;
    c.enablePan = pan;
    c.minDistance = min;
    c.maxDistance = max;
    if (maxPolar !== undefined) c.maxPolarAngle = maxPolar;
    c.target.set(target[0], target[1], target[2]);
    ctl.current = c;
    const off = wheel === "ctrl" ? ctrlWheelZoom(gl.domElement, (on) => (c.enableZoom = on)) : null;
    return () => {
      off?.();
      c.dispose();
      ctl.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, min, max, pan, maxPolar, wheel]);
  useFrame(() => {
    ctl.current?.update();
  });
  return null;
}

/**
 * Move the camera back or forward so a sphere of this radius (plus its glow) always fits
 * inside the canvas, whatever its shape: wide screens, tall phones, zoomed-out browsers.
 */
export function FitSphere({ radius = 1.08, fill = 0.92 }: { radius?: number; fill?: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (!cam.isPerspectiveCamera || !size.width || !size.height) return;
    const vHalf = ((cam.fov * Math.PI) / 180) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * (size.width / size.height));
    const d = radius / Math.sin(Math.min(vHalf, hHalf) * fill);
    cam.position.setLength(d);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height, radius, fill]);
  return null;
}

/**
 * Put one inside every <Canvas>. three.js r186 keeps a single shared lookup texture for
 * physically based materials (getDFGLUT, not exported) and every renderer that draws one adds a
 * "dispose" listener to it, so each old renderer, its canvas and the whole page around it stayed in
 * memory after navigating away (heap snapshots: about 1 MB per visit to Home). Releasing that
 * texture when the scene unmounts makes three.js drop the listeners; it uploads again when needed.
 */
let sharedLUT: THREE.Texture | null = null;

export function ReleaseGPU() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const looked = useRef(0);
  // find the shared texture while the scene is drawn (by unmount the meshes are already gone)
  useFrame(() => {
    if (sharedLUT || looked.current > 240 || looked.current++ % 30 !== 1) return;
    scene.traverse((o) => {
      const mats = (o as THREE.Mesh).material;
      for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
        const lut = (gl.properties.get(m) as { uniforms?: Record<string, { value?: unknown }> }).uniforms?.dfgLUT?.value;
        if (lut instanceof THREE.Texture) sharedLUT = lut;
      }
    });
  });
  useEffect(() => () => sharedLUT?.dispose(), []);
  return null;
}

/**
 * Lowers the canvas resolution on slow GPUs (software rendering, old laptops): after the first
 * second, if frames average slower than about 22 per second, the pixel ratio steps down by a
 * quarter, never below 0.5 and never back up. A normal GPU at 60 fps never triggers it.
 */
export function AdaptiveDpr() {
  const setDpr = useThree((s) => s.setDpr);
  const st = useRef({ frames: 0, n: 0, t: 0, dpr: 0 });
  useFrame((state, dt) => {
    const s = st.current;
    if (++s.frames === 2) {
      const gl = state.gl.getContext();
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      if (info && SOFTWARE_GL.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)))) enableLiteGraphics();
    }
    if (s.frames < 60 || dt > 0.25) return; // skip shader warm-up and resumed background tabs
    if (!s.dpr) s.dpr = state.viewport.dpr;
    s.n++;
    s.t += dt;
    if (s.n < 30) return;
    const avg = s.t / s.n;
    s.n = 0;
    s.t = 0;
    if (avg > 0.045 && s.dpr > 0.5) {
      s.dpr = Math.max(0.5, s.dpr * 0.75);
      setDpr(s.dpr);
      enableLiteGraphics();
    }
  });
  return null;
}
