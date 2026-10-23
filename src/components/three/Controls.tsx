import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ctrlWheelZoom } from "../../lib/wheel";

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
    const c = new OrbitControls(camera, gl.domElement);
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
