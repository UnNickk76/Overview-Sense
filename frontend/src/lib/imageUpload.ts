import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

export type LoadResult = { base64: string } | { error: string };

// Direct, full-resolution read of a local file as base64. Canonical, reliable
// path for file:// URIs stored in app documents. Tries a couple of encoding
// shapes and path variants to be robust across SDK versions.
async function rawRead(uri: string): Promise<string | null> {
  const paths = uri.startsWith("file://") ? [uri, uri.replace("file://", "")] : [uri];
  // Prefer the enum; fall back to the literal string the native module accepts.
  const encodings = [FileSystem.EncodingType?.Base64, "base64"].filter(Boolean) as string[];
  for (const enc of encodings) {
    for (const p of paths) {
      try {
        const b64 = await FileSystem.readAsStringAsync(p, { encoding: enc as FileSystem.EncodingType });
        if (b64 && b64.length > 100) return b64;
      } catch { /* try next */ }
    }
  }
  return null;
}

// Load a stored Sense image as upload-ready base64. Returns either the base64 or
// a concrete diagnostic string (so the UI can show WHY it failed instead of a
// vague "in preparazione"). A displayable Sense is always readable by at least
// one of these strategies.
export async function loadSenseImage(uri: string): Promise<LoadResult> {
  if (!uri) return { error: "uri-vuoto" };
  if (uri.startsWith("data:")) {
    const b = uri.split(",")[1];
    return b ? { base64: b } : { error: "data-uri-vuoto" };
  }
  const diag: string[] = [];

  // 1) Preferred: let the native layer downscale + compress. Two target sizes so
  // a memory spike on a very high-res photo still yields a smaller success.
  for (const width of [1440, 900]) {
    try {
      const m = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (m.base64 && m.base64.length > 100) return { base64: m.base64 };
      diag.push(`resize${width}:vuoto`);
    } catch (e) { diag.push(`resize${width}:${(e as Error)?.message || e}`); }
  }

  // 2) Reliable fallback: read the persisted file directly (full resolution).
  try {
    const raw = await rawRead(uri);
    if (raw) return { base64: raw };
    diag.push("file:null");
  } catch (e) { diag.push(`file:${(e as Error)?.message || e}`); }

  return { error: diag.join(" | ") || "sconosciuto" };
}

// Back-compat helper (offline queue flush + gallery quick-publish).
export async function senseImageBase64(uri: string): Promise<string | null> {
  const r = await loadSenseImage(uri);
  return "base64" in r ? r.base64 : null;
}
