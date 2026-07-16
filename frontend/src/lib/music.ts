import { apiFetch } from "./client";

// Normalized track — provider-agnostic (Jamendo now; commercial catalogs later
// map into the SAME shape, so this app code never changes).
export interface MusicTrack {
  id: string;
  provider: string;
  provider_track_id?: string;
  audio_id?: string;            // set when the "track" is user-recorded audio
  title: string;
  artist: string;
  album?: string;
  duration: number;             // seconds
  cover_url?: string | null;
  audio_url?: string | null;    // streamable/previewable MP3
  license_url?: string | null;
  share_url?: string | null;
}

// The reference saved on a SenseShot — we store the REFERENCE, never a copy of the file.
export interface MusicRef {
  provider: string;
  provider_track_id?: string;
  audio_id?: string;
  title: string;
  artist: string;
  cover_url?: string | null;
  audio_url?: string | null;
  license_url?: string | null;
  start: number;                // trim start (seconds)
  duration: number;             // trim length (seconds)
}

export interface MusicSearch {
  q?: string; artist?: string; genre?: string; mood?: string; limit?: number;
}

export const musicApi = {
  search: (f: MusicSearch = {}) => {
    const q = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") q.append(k, String(v)); });
    return apiFetch<{ items: MusicTrack[]; provider: string; error?: string }>(`/music/search?${q.toString()}`);
  },
  // Re-resolve a saved track to check it's still available.
  track: (provider: string, id: string) =>
    apiFetch<{ available: boolean; track: MusicTrack | null }>(`/music/track/${provider}/${id}`),
};

// Suggested mood filters (map to Jamendo fuzzytags) — the user is always free to search freely.
export const MUSIC_MOODS = ["relaxing", "cinematic", "ambient", "happy", "epic", "chill", "dark", "acoustic"];
export const MUSIC_GENRES = ["ambient", "electronic", "classical", "rock", "pop", "jazz", "lofi", "soundtrack"];
