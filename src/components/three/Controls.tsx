import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/** Thin OrbitControls wrapper (avoids pulling in a whole helper library). */
export function Orbit({
  min = 1.6,
  max = 6,
  pan = false,
  target = [0, 0, 0],
  maxPolar,
}: {
  min?: number;
  max?: number;
  pan?: boolean;
  target?: [number, number, number];
  maxPolar?: number;
}) {
  const { camera, gl, invalidate } = useThree();
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
    c.target.set(...target);
    let raf = 0;
    const loop = () => {
      c.update();
      raf = requestAnimationFrame(loop);
    };
    loop();
    c.addEventListener("change", () => invalidate());
    return () => {
      cancelAnimationFrame(raf);
      c.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, min, max, pan, maxPolar]);
  return null;
}
