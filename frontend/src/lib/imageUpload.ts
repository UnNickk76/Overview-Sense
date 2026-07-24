import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

// A saved Sense MUST always be publishable. This ALWAYS yields upload-ready
// base64 for a stored image: it prefers a resized/compressed JPEG (smaller upload)
// but NEVER hard-fails while the source file exists — it falls back to reading the
// persisted file directly. Returns null only if the file is truly unreadable.
export async function senseImageBase64(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith("data:")) return uri.split(",")[1] ?? null;

  // 1) Preferred: resize + compress for a lean upload.
  try {
    const m = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (m.base64) return m.base64;
  } catch { /* fall through to raw read */ }

  // 2) Fallback: read the persisted file as-is (full resolution, no processing).
  for (const p of [uri, uri.replace("file://", "")]) {
    try {
      const b64 = await FileSystem.readAsStringAsync(p, { encoding: FileSystem.EncodingType.Base64 });
      if (b64) return b64;
    } catch { /* try next form */ }
  }
  return null;
}
