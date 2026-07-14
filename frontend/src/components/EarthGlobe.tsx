import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, TextureLoader } from "@/src/components/universe/r3f";

// Continuous Earth globe — reuses the same three.js/expo-gl engine as the Universe.
// Level 1-3 of the unified Explorer: stylized → NASA-textured scientific reconstruction.
export interface EarthCtrl {
  az: number; pol: number; rad: number;
  idleSpin: boolean;
  renderer?: THREE.WebGLRenderer | null;
}
export function makeEarthCtrl(): EarthCtrl {
  return { az: 0.6, pol: 1.15, rad: 3.2, idleSpin: true, renderer: null };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const DAY = "https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg";
const CLOUDS = "https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg";

function useTex(url: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    try {
      const loader = new (TextureLoader as unknown as { new (): THREE.TextureLoader })();
      loader.load(url, (t: THREE.Texture) => { if (alive) setTex(t); }, undefined, () => {});
    } catch { /* colour fallback */ }
    return () => { alive = false; };
  }, [url]);
  return tex;
}

function EarthBody() {
  const day = useTex(DAY);
  const clouds = useTex(CLOUDS);
  const cloudRef = useRef<THREE.Mesh>(null);
  useFrame((_: unknown, d: number) => { if (cloudRef.current) cloudRef.current.rotation.y += d * 0.006; });
  return (
    <group>
      {/* Atmosphere glow */}
      <mesh>
        <sphereGeometry args={[1.16, 48, 48]} />
        <meshBasicMaterial color="#4aa8ff" transparent opacity={0.12} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* Earth surface (reconstruction) */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial map={day ?? undefined} color={day ? "#ffffff" : "#12305e"} roughness={0.9} metalness={0.02} />
      </mesh>
      {/* Clouds */}
      {clouds ? (
        <mesh ref={cloudRef}>
          <sphereGeometry args={[1.012, 48, 48]} />
          <meshStandardMaterial alphaMap={clouds} color="#ffffff" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function Rig({ ctrl }: { ctrl: React.MutableRefObject<EarthCtrl> }) {
  const { camera, gl } = useThree();
  const cur = useRef({ az: ctrl.current.az, pol: ctrl.current.pol, rad: ctrl.current.rad });
  useEffect(() => { ctrl.current.renderer = gl as unknown as THREE.WebGLRenderer; }, [gl, ctrl]);
  useFrame((_: unknown, d: number) => {
    const c = cur.current; const t = ctrl.current;
    if (t.idleSpin) t.az += d * 0.05; // slow auto-rotation until the user interacts
    c.az += (t.az - c.az) * 0.1;
    c.pol += (clamp(t.pol, 0.2, Math.PI - 0.2) - c.pol) * 0.1;
    c.rad += (t.rad - c.rad) * 0.1;
    const sp = Math.sin(c.pol), cp = Math.cos(c.pol);
    camera.position.set(c.rad * sp * Math.sin(c.az), c.rad * cp, c.rad * sp * Math.cos(c.az));
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export function EarthGlobe({ ctrl }: { ctrl: React.MutableRefObject<EarthCtrl> }) {
  const sun = useMemo(() => [5, 2, 3] as [number, number, number], []);
  return (
    <Canvas camera={{ position: [0, 1, 3.2], fov: 50, near: 0.01, far: 100 }} style={{ flex: 1 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <color attach="background" args={["#02040a"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={sun} intensity={1.6} />
      <EarthBody />
      <Rig ctrl={ctrl} />
    </Canvas>
  );
}
