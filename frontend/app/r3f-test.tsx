import React, { useRef } from "react";
import { View, StyleSheet } from "react-native";
import * as THREE from "three";
import { Canvas, useFrame } from "@/src/components/universe/r3f";

function SpinningSphere() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.4;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1.2, 48, 48]} />
      <meshStandardMaterial color="#E6B450" roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

function Stars() {
  const positions = React.useMemo(() => {
    const arr = new Float32Array(800 * 3);
    for (let i = 0; i < arr.length; i++) arr[i] = (Math.random() - 0.5) * 40;
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} color="#ffffff" sizeAttenuation />
    </points>
  );
}

export default function R3FTest() {
  return (
    <View style={styles.root}>
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }} style={{ flex: 1 }}>
        <color attach="background" args={["#03060d"]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} intensity={2} />
        <Stars />
        <SpinningSphere />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#03060d" } });
