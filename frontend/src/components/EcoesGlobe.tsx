import React, { useRef } from "react";
import { Circle, G } from "react-native-svg";
import { GlobeBase, GlobeCtx, GlobeHandle } from "@/src/components/GlobeBase";
import { colors } from "@/src/theme";
import { EcoesConn } from "@/src/lib/backend";

type Cluster = { sx: number; sy: number; meanLat: number; meanLon: number; intensity: number; members: EcoesConn[] };

/**
 * Ecoes Globe = the SHARED OverView Earth (GlobeBase) with ONLY the Ecoes layer
 * on top: Connection pulsations anchored to the sphere, visual merging when many
 * are close (no numbers), selection, and zoom-in to separate a merged eco.
 */
export function EcoesGlobe({ items, size, onSelect, onInteracting }: {
  items: EcoesConn[]; size: number; onSelect: (c: EcoesConn) => void; onInteracting?: (active: boolean) => void;
}) {
  const globe = useRef<GlobeHandle>(null);
  const clustersRef = useRef<Cluster[]>([]);

  const buildClusters = (ctx: GlobeCtx): Cluster[] => {
    const thr = 26;
    const cls: Cluster[] = [];
    for (const c of items) {
      const p = ctx.proj(c.lat, c.lon);
      if (p.z < 0.02) continue;
      const near = cls.find((k) => Math.hypot(k.sx - p.sx, k.sy - p.sy) < thr);
      if (near) {
        const n = near.members.length + 1;
        near.sx = (near.sx * (n - 1) + p.sx) / n;
        near.sy = (near.sy * (n - 1) + p.sy) / n;
        near.meanLat = (near.meanLat * (n - 1) + c.lat) / n;
        near.meanLon = (near.meanLon * (n - 1) + c.lon) / n;
        near.intensity = Math.max(near.intensity, c.intensity);
        near.members.push(c);
      } else {
        cls.push({ sx: p.sx, sy: p.sy, meanLat: c.lat, meanLon: c.lon, intensity: c.intensity, members: [c] });
      }
    }
    clustersRef.current = cls;
    return cls;
  };

  const overlay = (ctx: GlobeCtx) => {
    const clusters = buildClusters(ctx);
    const phase = (ctx.tick % 26) / 26;
    return (
      <G>
        {clusters.map((c, i) => {
          const many = c.members.length > 1;
          const strong = c.intensity >= 0.45;
          const color = strong ? colors.brand : colors.blue;
          // Vitality → pulse speed/size (never numbers). Dormant = slow, faint.
          const speed = 0.6 + c.intensity * 1.6;
          const pulse = 0.5 + 0.5 * Math.sin(phase * 2 * Math.PI * speed + i);
          const core = many ? 3.4 + Math.min(4, c.members.length) : 2.9;
          const halo = (many ? 9 + Math.min(10, c.members.length * 1.6) : 6.5) + (2 + c.intensity * 3) * pulse;
          return (
            <G key={many ? `cl${i}` : c.members[0].id}>
              <Circle cx={c.sx} cy={c.sy} r={halo} fill={color} opacity={(0.12 + 0.14 * pulse) * (0.5 + c.intensity * 0.5)} />
              <Circle cx={c.sx} cy={c.sy} r={core} fill={color} opacity={0.95} />
              {many ? <Circle cx={c.sx} cy={c.sy} r={core + 3} fill="none" stroke={color} strokeWidth={0.8} opacity={0.5} /> : null}
            </G>
          );
        })}
      </G>
    );
  };

  const handleTap = (x: number, y: number) => {
    const thr = 26;
    const hits = clustersRef.current
      .map((c) => ({ c, d: Math.hypot(c.sx - x, c.sy - y) }))
      .filter((h) => h.d < thr + h.c.members.length * 2)
      .sort((a, b) => a.d - b.d);
    if (!hits.length) return;
    const cl = hits[0].c;
    if (cl.members.length === 1) onSelect(cl.members[0]);
    else globe.current?.focus(cl.meanLat, cl.meanLon, 2.1); // separate the merged eco
  };

  return (
    <GlobeBase
      ref={globe}
      size={size}
      onInteracting={onInteracting}
      overlay={overlay}
      onTap={(x, y) => handleTap(x, y)}
    />
  );
}
