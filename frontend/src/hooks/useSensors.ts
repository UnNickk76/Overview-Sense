import { useEffect, useState } from "react";
import { Magnetometer, Accelerometer, DeviceMotion } from "expo-sensors";

export interface MagReading { x: number; y: number; z: number; magnitude: number }

// Magnetic field vector (microtesla) + total magnitude.
export function useMagnetometer(active = true, interval = 200): MagReading {
  const [r, setR] = useState<MagReading>({ x: 0, y: 0, z: 0, magnitude: 0 });
  useEffect(() => {
    if (!active) return;
    Magnetometer.setUpdateInterval(interval);
    const sub = Magnetometer.addListener((d) => {
      const magnitude = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
      setR({ x: d.x, y: d.y, z: d.z, magnitude });
    });
    return () => sub.remove();
  }, [active, interval]);
  return r;
}

// Device compass heading (0-360, magnetic) from magnetometer.
export function useHeading(active = true, interval = 120): number {
  const [heading, setHeading] = useState(0);
  useEffect(() => {
    if (!active) return;
    Magnetometer.setUpdateInterval(interval);
    const sub = Magnetometer.addListener((d) => {
      let angle = Math.atan2(d.y, d.x) * (180 / Math.PI);
      angle = (angle + 360) % 360;
      setHeading(angle);
    });
    return () => sub.remove();
  }, [active, interval]);
  return heading;
}

export interface AccelReading { x: number; y: number; z: number; magnitude: number }

// Acceleration incl. gravity (g units).
export function useAccelerometer(active = true, interval = 200): AccelReading {
  const [r, setR] = useState<AccelReading>({ x: 0, y: 0, z: 0, magnitude: 0 });
  useEffect(() => {
    if (!active) return;
    Accelerometer.setUpdateInterval(interval);
    const sub = Accelerometer.addListener((d) => {
      const magnitude = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
      setR({ x: d.x, y: d.y, z: d.z, magnitude });
    });
    return () => sub.remove();
  }, [active, interval]);
  return r;
}

export interface Attitude { pitch: number; roll: number; yaw: number }

// Device attitude (radians) for AR sky pointing.
export function useAttitude(active = true, interval = 80): Attitude {
  const [a, setA] = useState<Attitude>({ pitch: 0, roll: 0, yaw: 0 });
  useEffect(() => {
    if (!active) return;
    DeviceMotion.setUpdateInterval(interval);
    const sub = DeviceMotion.addListener((d) => {
      if (d.rotation) setA({ pitch: d.rotation.beta, roll: d.rotation.gamma, yaw: d.rotation.alpha });
    });
    return () => sub.remove();
  }, [active, interval]);
  return a;
}
