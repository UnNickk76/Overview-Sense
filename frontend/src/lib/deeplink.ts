// Centralised deep-link / QR helpers.
// The QR on a saved Observation points to the smart landing page (served by the
// backend at /api/go/<id>): it opens the OverView app if installed, otherwise
// falls back to the App/Play Store (or the web page on desktop).
const WEB_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

export const APP_SCHEME = "overview";

/** Smart landing URL to encode in a QR code. */
export function observationLandingUrl(id: string): string {
  return `${WEB_BASE}/api/go/${id}`;
}

/** In-app deep link (opens the detail screen directly when the app is running). */
export function observationAppUrl(id: string): string {
  return `${APP_SCHEME}://observation-detail?id=${id}`;
}
