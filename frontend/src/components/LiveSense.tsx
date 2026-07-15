// Web fallback — Live Sense™ relies on the camera preview + device sensors and
// only runs on a native build. On web it renders nothing.
export function LiveSense(_props: { zoomFactor?: number; active: boolean; snapshot?: () => Promise<string | null> }) {
  return null;
}
