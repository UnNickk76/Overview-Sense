import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

// Read a local file as base64 via fetch + FileReader. This is the most reliable
// cross-platform path: if the image is displayable (it is — it shows in the
// Gallery), fetch(file://…) can read it, independent of expo-file-system.
async function fetchBase64(uri: string): Promise<string | null> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(blob);
    });
    const comma = dataUrl.indexOf(",");
    return comma >= 0 ? dataUrl.slice(comma + 1) : null;
  } catch { return null; }
}

// A saved Sense MUST always be publishable. This ALWAYS yields upload-ready
// base64 for a stored image. It tries, in order: (1) resize+compress for a lean
// upload, (2) direct fetch→base64 (works whenever the image is displayable),
// (3) a raw FileSystem read. Returns null only if the file is truly unreadable.
export async function senseImageBase64(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith("data:")) return uri.split(",")[1] ?? null;

  // 1) Preferred: resize + compress (smaller upload). Best-effort — never fatal.
  try {
    const m = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (m.base64) return m.base64;
  } catch { /* fall through */ }

  // 2) Reliable: fetch the local file and convert to base64.
  const viaFetch = await fetchBase64(uri);
  if (viaFetch) return viaFetch;

  // 3) Fallback: read the persisted file directly (full resolution).
  for (const p of [uri, uri.replace("file://", "")]) {
    try {
      const b64 = await FileSystem.readAsStringAsync(p, { encoding: FileSystem.EncodingType.Base64 });
      if (b64) return b64;
    } catch { /* try next */ }
  }
  return null;
}
