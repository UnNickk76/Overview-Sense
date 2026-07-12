import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

export interface Observer {
  lat: number;
  lon: number;
  altitude: number | null;
  accuracy: number | null;
  status: "loading" | "granted" | "denied" | "blocked";
  canAskAgain: boolean;
  request: () => Promise<void>;
}

export function useObserver(): Observer {
  const [lat, setLat] = useState(0);
  const [lon, setLon] = useState(0);
  const [altitude, setAltitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<Observer["status"]>("loading");
  const [canAskAgain, setCanAskAgain] = useState(true);

  const request = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    setCanAskAgain(perm.canAskAgain);
    if (perm.status !== "granted") {
      setStatus(perm.canAskAgain ? "denied" : "blocked");
      return;
    }
    setStatus("granted");
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLat(loc.coords.latitude);
    setLon(loc.coords.longitude);
    setAltitude(loc.coords.altitude);
    setAccuracy(loc.coords.accuracy);
  };

  useEffect(() => {
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      setCanAskAgain(perm.canAskAgain);
      if (perm.status === "granted") {
        setStatus("granted");
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLat(loc.coords.latitude);
        setLon(loc.coords.longitude);
        setAltitude(loc.coords.altitude);
        setAccuracy(loc.coords.accuracy);
      } else {
        setStatus("loading");
        await request();
      }
    })();
  }, []);

  return { lat, lon, altitude, accuracy, status, canAskAgain, request };
}

// Ticking clock that updates every `intervalMs`.
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(new Date());
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    ref.current = setInterval(() => setNow(new Date()), intervalMs);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [intervalMs]);
  return now;
}
