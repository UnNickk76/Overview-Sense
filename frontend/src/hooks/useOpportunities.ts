import { useEffect, useMemo, useState } from "react";
import { useObserver, useNow } from "./useObserver";
import { api, Weather, SpaceWeather } from "@/src/lib/api";
import { loadSatrecs, hasSatrecs } from "@/src/lib/satellites";
import { computeOpportunities, Opportunity, LayerKey } from "@/src/lib/opportunities";
import { cacheOpportunities } from "@/src/lib/opportunityStore";

let satsLoaded = false;

export function useOpportunities(layer?: LayerKey) {
  const obs = useObserver();
  const now = useNow(60000); // recompute each minute
  const [weather, setWeather] = useState<Weather | null>(null);
  const [space, setSpace] = useState<SpaceWeather | null>(null);
  const [satsReady, setSatsReady] = useState(hasSatrecs());

  useEffect(() => {
    api.spaceWeather().then(setSpace).catch(() => {});
    if (!satsLoaded) {
      api.satellites().then((r) => {
        if (r.available && r.satellites?.length) {
          loadSatrecs(r.satellites);
          satsLoaded = true;
          setSatsReady(true);
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (obs.status === "granted") api.weather(obs.lat, obs.lon).then(setWeather).catch(() => {});
  }, [obs.status, obs.lat, obs.lon]);

  const all = useMemo(() => {
    const list = computeOpportunities({
      now, lat: obs.lat, lon: obs.lon, altitude: obs.altitude,
      hasLoc: obs.status === "granted", weather, space, satsReady,
    });
    cacheOpportunities(list);
    return list;
  }, [now, obs.status, obs.lat, obs.lon, obs.altitude, weather, space, satsReady]);

  const opportunities = useMemo(
    () => (layer ? all.filter((o) => o.layer === layer) : all),
    [all, layer],
  );

  return { opportunities, all, loading: obs.status === "loading", observer: obs };
}
