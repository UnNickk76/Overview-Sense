import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image as RNImage } from "react-native";
import * as THREE from "three";
import { Asset } from "expo-asset";
import { Canvas, useFrame, useThree, TextureLoader } from "@/src/components/universe/r3f";

// Continuous Earth globe — reuses the same three.js/expo-gl engine as the Universe.
// Textures are bundled locally (NASA Blue Marble, public domain) → always load, no CORS.
export interface EarthCtrl {
  az: number; pol: number; rad: number;
  idleSpin: boolean;
  renderer?: THREE.WebGLRenderer | null;
}
export function makeEarthCtrl(): EarthCtrl {
  return { az: 0.6, pol: 1.15, rad: 3.2, idleSpin: true, renderer: null };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const DAY = require("@/assets/textures/earth_day.jpg");
const NIGHT = require("@/assets/textures/earth_night.jpg");

function useAssetTexture(mod: number) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      let uri: string | undefined;
      try {
        const asset = Asset.fromModule(mod);
        if (!asset.localUri && !asset.uri) await asset.downloadAsync();
        uri = asset.localUri || asset.uri;
      } catch { /* fall through */ }
      if (!uri) uri = RNImage.resolveAssetSource(mod)?.uri;
      if (!uri) return;
      try {
        const loader = new (TextureLoader as unknown as { new (): THREE.TextureLoader })();
        loader.load(uri, (t: THREE.Texture) => { if (alive) setTex(t); }, undefined, () => { /* keep colour */ });
      } catch { /* keep colour */ }
    })();
    return () => { alive = false; };
  }, [mod]);
  return tex;
}

// Real subsolar direction from the current date/time → where the Sun lights the Earth.
function sunDirection(date: Date): THREE.Vector3 {
  const rad = Math.PI / 180;
  const startY = Date.UTC(date.getUTCFullYear(), 0, 0);
  const doy = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - startY) / 86400000;
  const decl = 23.44 * Math.sin(rad * (360 / 365) * (doy - 81));
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60;
  const subLon = -15 * (utcH - 12); // longitude with the Sun overhead (local noon)
  const latR = decl * rad, lonR = subLon * rad;
  return new THREE.Vector3(Math.cos(latR) * Math.sin(lonR), Math.sin(latR), Math.cos(latR) * Math.cos(lonR)).normalize();
}

function EarthBody({ sun }: { sun: THREE.Vector3 }) {
  const day = useAssetTexture(DAY);
  const night = useAssetTexture(NIGHT);
  return (
    <group>
      {/* Atmosphere glow (only meaningful while the globe is spherical) */}
      <mesh>
        <sphereGeometry args={[1.16, 48, 48]} />
        <meshBasicMaterial color="#4aa8ff" transparent opacity={0.12} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* Earth surface — day map + night city lights (emissive) create a realistic terminator */}
      <mesh key={day ? "earth-tex" : "earth-plain"}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial
          map={day ?? undefined}
          color={day ? "#ffffff" : "#1a3a66"}
          emissiveMap={night ?? undefined}
          emissive={new THREE.Color(night ? "#fff0cc" : "#000000")}
          emissiveIntensity={night ? 0.28 : 0}
          roughness={1.0}
          metalness={0.0}
        />
      </mesh>
    </group>
  );
}

function Rig({ ctrl, sunRef }: { ctrl: React.MutableRefObject<EarthCtrl>; sunRef: React.MutableRefObject<THREE.DirectionalLight | null> }) {
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
  const sun = useMemo(() => sunDirection(new Date()), []);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  return (
    <Canvas camera={{ position: [0, 1, 3.2], fov: 50, near: 0.01, far: 100 }} style={{ flex: 1 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <color attach="background" args={["#02040a"]} />
      <ambientLight intensity={0.32} />
      <directionalLight ref={sunRef} position={[sun.x * 10, sun.y * 10, sun.z * 10]} intensity={2.2} />
      <EarthBody sun={sun} />
      <Rig ctrl={ctrl} sunRef={sunRef} />
    </Canvas>
  );
}
