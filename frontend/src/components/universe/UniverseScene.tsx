import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, TextureLoader, GLTFLoader } from "@/src/components/universe/r3f";
import { UObject } from "@/src/lib/universe";

// Shared, mutable control state (no re-render). Screen writes desired camera;
// scene lerps toward it and publishes projected screen positions for hit-testing.
export interface ControlState {
  az: number;         // desired azimuth (rad)
  pol: number;        // desired polar (rad, clamped)
  rad: number;        // desired distance
  target: [number, number, number];
  screen: { id: string; x: number; y: number; visible: boolean }[];
  renderer?: THREE.WebGLRenderer | null;   // exposed for clean 3D snapshots
}

export function makeControls(rad: number): ControlState {
  return { az: 0.6, pol: 1.15, rad, target: [0, 0, 0], screen: [] };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// Load a remote texture imperatively; on failure stay null (colour fallback).
// This never throws in render, so a blocked/slow image can't crash the scene.
function useRemoteTexture(url?: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    try {
      const loader = new (TextureLoader as unknown as { new (): THREE.TextureLoader })();
      loader.load(url, (t: THREE.Texture) => { if (alive) setTex(t); }, undefined, () => { /* keep colour */ });
    } catch { /* keep colour */ }
    return () => { alive = false; };
  }, [url]);
  return tex;
}

function SphereBody({ o }: { o: UObject }) {
  const tex = useRemoteTexture(o.texture);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_: unknown, d: number) => { if (ref.current && !o.emissive) ref.current.rotation.y += d * 0.08; });
  return (
    <mesh ref={ref} position={o.pos}>
      <sphereGeometry args={[o.size, 40, 40]} />
      {o.emissive
        ? <meshBasicMaterial color="#ffffff" map={tex ?? undefined} {...(tex ? {} : { color: o.color })} />
        : <meshStandardMaterial map={tex ?? undefined} color={tex ? "#ffffff" : o.color} roughness={0.85} metalness={0.05} />}
    </mesh>
  );
}

// Load a glTF model imperatively; normalise scale + centre. Never throws in render.
function useGltf(url?: string, targetMax = 1.2) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    try {
      const loader = new (GLTFLoader as unknown as { new (): { load: (u: string, cb: (g: { scene: THREE.Object3D }) => void, p?: unknown, e?: (err: unknown) => void) => void } })();
      loader.load(
        url,
        (g) => {
          if (!alive || !g?.scene) return;
          const scene = g.scene;
          const box = new THREE.Box3().setFromObject(scene);
          const size = new THREE.Vector3(); box.getSize(size);
          const center = new THREE.Vector3(); box.getCenter(center);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const s = targetMax / maxDim;
          scene.scale.setScalar(s);
          scene.position.set(-center.x * s, -center.y * s, -center.z * s);
          setObj(scene);
        },
        undefined,
        () => { /* keep sphere fallback */ },
      );
    } catch { /* keep sphere fallback */ }
    return () => { alive = false; };
  }, [url, targetMax]);
  return obj;
}

function ModelBody({ o }: { o: UObject }) {
  const obj = useGltf(o.model, Math.max(o.size * 8, 1.2));
  const ref = useRef<THREE.Group>(null);
  useFrame((_: unknown, d: number) => { if (ref.current) ref.current.rotation.y += d * 0.25; });
  if (!obj) return <SphereBody o={o} />;
  return (
    <group position={o.pos}>
      <group ref={ref}><primitive object={obj} /></group>
    </group>
  );
}

function Halo({ o }: { o: UObject }) {
  return (
    <mesh position={o.pos}>
      <sphereGeometry args={[o.size * 1.7, 24, 24]} />
      <meshBasicMaterial color={o.color} transparent opacity={0.14} depthWrite={false} />
    </mesh>
  );
}

function Body({ o, selected }: { o: UObject; selected: boolean }) {
  const glow = o.emissive || ["nebula", "structure", "galaxy", "galaxycluster", "blackhole"].includes(o.kind);
  return (
    <group>
      {glow && <Halo o={o} />}
      {o.model ? <ModelBody o={o} /> : <SphereBody o={o} />}
      {o.ring && (
        <mesh position={o.pos} rotation={[Math.PI / 2.6, 0, 0]}>
          <ringGeometry args={[o.size * 1.4, o.size * 2.2, 48]} />
          <meshBasicMaterial color="#d8c69a" side={THREE.DoubleSide} transparent opacity={0.7} />
        </mesh>
      )}
      {selected && (
        <mesh position={o.pos} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[o.size * 1.9, o.size * 0.06 + 0.02, 8, 64]} />
          <meshBasicMaterial color="#E6B450" />
        </mesh>
      )}
    </group>
  );
}

function Starfield() {
  const positions = useMemo(() => {
    const arr = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) {
      const r = 120 + Math.random() * 260;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(ph) * Math.cos(th);
      arr[i * 3 + 1] = r * Math.cos(ph);
      arr[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.7} color="#ffffff" sizeAttenuation transparent opacity={0.85} />
    </points>
  );
}

function Rig({ ctrl, objects }: { ctrl: React.MutableRefObject<ControlState>; objects: UObject[] }) {
  const { camera, size, gl } = useThree();
  const cur = useRef({ az: ctrl.current.az, pol: ctrl.current.pol, rad: ctrl.current.rad, tx: 0, ty: 0, tz: 0 });
  const v = useRef(new THREE.Vector3());

  useEffect(() => { ctrl.current.renderer = gl as unknown as THREE.WebGLRenderer; }, [gl, ctrl]);

  useFrame(() => {
    const c = cur.current;
    const d = ctrl.current;
    // Smooth toward desired.
    c.az += (d.az - c.az) * 0.08;
    c.pol += (clamp(d.pol, 0.15, Math.PI - 0.15) - c.pol) * 0.08;
    c.rad += (d.rad - c.rad) * 0.08;
    c.tx += (d.target[0] - c.tx) * 0.06;
    c.ty += (d.target[1] - c.ty) * 0.06;
    c.tz += (d.target[2] - c.tz) * 0.06;
    const sp = Math.sin(c.pol), cp = Math.cos(c.pol);
    camera.position.set(
      c.tx + c.rad * sp * Math.sin(c.az),
      c.ty + c.rad * cp,
      c.tz + c.rad * sp * Math.cos(c.az),
    );
    camera.lookAt(c.tx, c.ty, c.tz);

    // Publish projected screen positions for tap hit-testing.
    const out: ControlState["screen"] = [];
    for (const o of objects) {
      v.current.set(o.pos[0], o.pos[1], o.pos[2]).project(camera);
      out.push({
        id: o.id,
        x: (v.current.x * 0.5 + 0.5) * size.width,
        y: (-v.current.y * 0.5 + 0.5) * size.height,
        visible: v.current.z < 1,
      });
    }
    ctrl.current.screen = out;
  });
  return null;
}

export function UniverseScene({ objects, selectedId, ctrl }: {
  objects: UObject[];
  selectedId: string | null;
  ctrl: React.MutableRefObject<ControlState>;
}) {
  return (
    <Canvas camera={{ position: [0, 6, 30], fov: 55, near: 0.05, far: 2000 }} style={{ flex: 1 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <color attach="background" args={["#02040a"]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 0, 0]} intensity={2.4} distance={0} decay={0} />
      <pointLight position={[40, 30, 20]} intensity={0.6} />
      <Starfield />
      {objects.map((o) => <Body key={o.id} o={o} selected={o.id === selectedId} />)}
      <Rig ctrl={ctrl} objects={objects} />
    </Canvas>
  );
}
