import { apiFetch, mediaUrl } from "./client";
import { ObsData } from "./gallery";
import type { MusicRef } from "./music";

export { mediaUrl };

export interface ProfileLink { label?: string; url: string }

export interface AuthUser {
  id: string;
  email?: string;
  nickname: string;
  display_name?: string;
  bio?: string;
  avatar?: string | null;
  author_code?: string;
  links?: ProfileLink[];
  role?: string;
  protected?: boolean;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export type GeoPrecision = "none" | "area" | "approx" | "exact";

export interface FeedObservation {
  id: string;
  user_id: string;
  nickname: string;
  avatar?: string | null;
  media_type: "image" | "audio" | "video";
  source: "reality" | "listening";
  category: string;
  categories: string[];
  caption: string;
  title?: string | null;
  hashtags?: string[];
  music?: MusicRef | null;
  tagged_users?: { id: string; nickname?: string }[];
  voice?: { media_id: string; duration: number; url: string } | null;
  scientific_value: number;
  ai_confidence?: number | null;
  image_url: string | null;
  lat?: number | null;
  lon?: number | null;
  data?: ObsData;
  geo_precision?: GeoPrecision;
  views: number;
  observed: number;
  discovery: number;
  learned: number;
  comments_count: number;
  saves_count: number;
  repost_count: number;
  created_at: string;
  overall_score: number;
  community_value: number;
  rarity_score: number;
  confirmed: boolean;
  my_interactions: string[];
  my_saved: boolean;
  reposted_by?: string | null;
  is_pulse?: boolean;
  pulse_task?: { id: string; title: string; theme: string; prompt?: string } | null;
  author?: { id: string; nickname: string; bio?: string; avatar?: string | null };
}

export interface CosmicImage {
  thumb: string;
  image: string;
  title: string;
  description: string;
  center?: string | null;
  date?: string | null;
}

export interface DiscoveryLevel {  key: string;
  title: string;
  points: number;
  index: number;
  total_levels: number;
  next_title: string | null;
  next_min: number | null;
  progress: number;
}

export interface Profile {
  id: string;
  nickname: string;
  display_name?: string;
  bio: string;
  avatar?: string | null;
  links?: ProfileLink[];
  created_at?: string;
  protected?: boolean;
  stats: { observations: number; observers: number; oviewers: number; followers: number; following: number };
  discovery_level?: DiscoveryLevel;
  is_following: boolean;
  is_me: boolean;
}

export interface Comment {
  id: string; obs_id: string; user_id: string; nickname: string; avatar?: string | null; text: string; created_at: string;
}

export type InteractionType = "observed" | "discovery" | "learned";

export interface ActivityEvent {
  kind: "observed" | "discovery" | "learned" | "comment" | "follow";
  actor_id: string;
  actor_nickname: string;
  actor_avatar?: string | null;
  obs_id: string | null;
  text?: string | null;
  created_at: string;
}

// ---- Auth ----
export const authApi = {
  register: (email: string, nickname: string, password: string) =>
    apiFetch<AuthResponse>("/auth/register", {
      method: "POST", body: JSON.stringify({ email, nickname, password }),
    }),
  login: (email: string, password: string) =>
    apiFetch<AuthResponse>("/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  me: () => apiFetch<AuthUser>("/auth/me"),
  nicknameAvailable: (nickname: string) =>
    apiFetch<{ available: boolean; reason?: string }>(`/auth/nickname-available?nickname=${encodeURIComponent(nickname)}`),
  updateProfile: (data: { bio?: string; nickname?: string; display_name?: string; links?: ProfileLink[] }) =>
    apiFetch<AuthUser>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
  changePassword: (current_password: string, new_password: string) =>
    apiFetch<{ ok: boolean }>("/auth/change-password", {
      method: "POST", body: JSON.stringify({ current_password, new_password }),
    }),
  updateAvatar: (image_base64: string) =>
    apiFetch<{ avatar: string }>("/users/me/avatar", {
      method: "POST", body: JSON.stringify({ image_base64 }),
    }),
};

// ---- Social ----
export interface FeedFilters {
  category?: string;
  media_type?: string;
  source?: string;
  sort?: string;
  window?: string;
  following?: boolean;
  lat?: number;
  lon?: number;
}

export const socialApi = {
  createObservation: (payload: {
    media_type?: string; source?: string; caption?: string;
    title?: string; description?: string; hashtags?: string[];
    music?: Record<string, unknown>; tagged_users?: { id: string; nickname?: string }[];
    voice?: { media_id: string; duration: number };
    image_base64?: string; data?: ObsData; ai_confidence?: number;
    is_pulse?: boolean; pulse_task?: { id: string; title: string; theme: string; prompt?: string };
  }) => apiFetch<FeedObservation>("/observations", {
    method: "POST", body: JSON.stringify(payload),
  }),
  uploadAudio: (base64: string, duration: number, content_type = "audio/m4a") =>
    apiFetch<{ id: string; url: string; duration: number }>("/media/audio", {
      method: "POST", body: JSON.stringify({ base64, content_type, duration }),
    }),
  feed: (f: FeedFilters = {}) => {
    const q = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") q.append(k, String(v)); });
    return apiFetch<{ items: FeedObservation[] }>(`/feed?${q.toString()}`);
  },
  observation: (id: string) => apiFetch<FeedObservation>(`/observations/${id}`),
  search: (q: string, offset = 0, limit = 30) =>
    apiFetch<{ items: FeedObservation[]; offset: number; has_more: boolean }>(
      `/search?q=${encodeURIComponent(q)}&offset=${offset}&limit=${limit}`,
    ),
  observationOfTheDay: () =>
    apiFetch<{ observation: FeedObservation | null }>("/observation-of-the-day"),
  cosmosImages: (q: string, limit = 10) =>
    apiFetch<{ images: CosmicImage[] }>(`/cosmos-images?q=${encodeURIComponent(q)}&limit=${limit}`),
  interact: (id: string, type: InteractionType) =>
    apiFetch<{ active: boolean; type: string; count: number }>(
      `/observations/${id}/interact`, { method: "POST", body: JSON.stringify({ type }) }),
  comments: (id: string) => apiFetch<{ items: Comment[] }>(`/observations/${id}/comments`),
  addComment: (id: string, text: string) =>
    apiFetch<Comment>(`/observations/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) }),
  profile: (id: string) => apiFetch<Profile>(`/users/${id}`),
  activity: () => apiFetch<{ items: ActivityEvent[]; count: number }>("/activity"),
  userObservations: (id: string) => apiFetch<{ items: FeedObservation[] }>(`/users/${id}/observations`),
  markSeen: (items: { id: string; dwell_ms: number }[]) =>
    apiFetch<{ ok: boolean; recorded: number }>("/observations/seen", { method: "POST", body: JSON.stringify({ items }) }),
  follow: (id: string) => apiFetch<{ following: boolean }>(`/users/${id}/follow`, { method: "POST" }),
  unfollow: (id: string) => apiFetch<{ following: boolean }>(`/users/${id}/follow`, { method: "DELETE" }),
  connections: () => apiFetch<{ items: { id: string; nickname: string; display_name?: string; avatar?: string | null; relation: "mutual" | "oviewer" | "observer" }[] }>("/users/me/connections"),
  save: (id: string) => apiFetch<{ saved: boolean }>(`/observations/${id}/save`, { method: "POST" }),
  repost: (id: string) => apiFetch<{ reposted: boolean }>(`/observations/${id}/repost`, { method: "POST" }),
  collection: (id: string) => apiFetch<{ items: FeedObservation[] }>(`/users/${id}/collection`),
  updateObservation: (id: string, payload: { caption?: string; legend_hidden?: string[]; legend_on?: boolean; sense_layers?: string[]; geo_precision?: GeoPrecision }) =>
    apiFetch<FeedObservation>(`/observations/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteObservation: (id: string) =>
    apiFetch<{ ok: boolean }>(`/observations/${id}`, { method: "DELETE" }),
};

// ---- Pulse™ ----
export interface GlobalPulse {
  id: string;
  title: string;
  theme: string;
  prompt: string;
  source: "auto" | "creator";
  global: boolean;
  starts_at: string;
  ends_at: string;
}

export const pulseApi = {
  feed: (taskId?: string) => {
    const q = taskId ? `?task_id=${encodeURIComponent(taskId)}` : "";
    return apiFetch<{ items: FeedObservation[] }>(`/pulse/feed${q}`);
  },
  compare: (obs_id_a: string, obs_id_b: string) =>
    apiFetch<{ text: string; theme: string }>("/pulse/compare", {
      method: "POST", body: JSON.stringify({ obs_id_a, obs_id_b }),
    }),
  globalActive: () => apiFetch<{ pulse: GlobalPulse; participants: number }>("/pulse/global/active"),
  globalFeed: (gid: string) =>
    apiFetch<{ items: FeedObservation[]; participants: number; countries: number }>(`/pulse/global/${gid}/feed`),
  setGlobal: (payload: { title: string; prompt: string; theme?: string; hours?: number }) =>
    apiFetch<GlobalPulse>("/creator/global-pulse", { method: "POST", body: JSON.stringify(payload) }),
  stopGlobal: () => apiFetch<{ ok: boolean }>("/creator/global-pulse", { method: "DELETE" }),
};

export interface VerifiedEvent {
  id: string;
  category: string;
  day: string;
  title: string;
  observers: number;
  observations: number;
  first_at: string;
  last_at: string;
  avg_scientific_value: number;
  centroid?: { lat: number; lon: number } | null;
  samples: string[];
  obs_ids: string[];
}

export interface LiveEarthPoint {
  id: string;
  lat: number;
  lon: number;
  category: string;
  intensity: number;
  created_at: string;
  image_url?: string | null;
  nickname?: string;
}

export interface LiveEarth {
  points: LiveEarthPoint[];
  total_recent: number;
  total_geolocated: number;
  window_hours: number;
}

export interface ObservationChain {
  category: string | null;
  title: string | null;
  day?: string;
  observers?: number;
  count?: number;
  scope?: string;
  items: FeedObservation[];
}

export const eventsApi = {
  verified: () => apiFetch<{ events: VerifiedEvent[] }>("/events/verified"),
  liveEarth: () => apiFetch<LiveEarth>("/events/live-earth"),
  chain: (id: string) => apiFetch<ObservationChain>(`/observations/${id}/chain`),
};

// ---- The Sense Collection™ ----
export type CollectionVisibility = "private" | "friends" | "public" | "collaborative";
export interface AutoRule { type: "category" | "source" | "hashtag"; value: string }
export interface SenseCollection {
  id: string;
  user_id: string;
  nickname?: string;
  title: string;
  description: string;
  visibility: CollectionVisibility;
  auto_rule?: AutoRule | null;
  dynamic: boolean;
  count: number;
  cover_url?: string | null;
  collaborators: string[];
  is_owner: boolean;
  created_at?: string;
  updated_at?: string;
}

export const collectionsApi = {
  create: (payload: {
    title: string; description?: string; visibility?: CollectionVisibility;
    auto_rule?: AutoRule | null; obs_ids?: string[]; cover_obs_id?: string;
  }) => apiFetch<SenseCollection>("/collections", { method: "POST", body: JSON.stringify(payload) }),
  mine: () => apiFetch<{ items: SenseCollection[] }>("/collections/mine"),
  ofUser: (userId: string) => apiFetch<{ items: SenseCollection[] }>(`/users/${userId}/collections`),
  detail: (id: string) => apiFetch<{ collection: SenseCollection; items: FeedObservation[] }>(`/collections/${id}`),
  update: (id: string, payload: Partial<{ title: string; description: string; visibility: CollectionVisibility; auto_rule: AutoRule | null; cover_obs_id: string; collaborators: string[] }>) =>
    apiFetch<SenseCollection>(`/collections/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: string) => apiFetch<{ ok: boolean }>(`/collections/${id}`, { method: "DELETE" }),
  addItem: (id: string, obs_id: string) =>
    apiFetch<{ ok: boolean }>(`/collections/${id}/items`, { method: "POST", body: JSON.stringify({ obs_id }) }),
  removeItem: (id: string, obs_id: string) =>
    apiFetch<{ ok: boolean }>(`/collections/${id}/items/${obs_id}`, { method: "DELETE" }),
};

// ---- Observe World™ (curated museum of reality — no likes) ----
export interface WorldBadge { key: string; label: string; value: number | null }
export interface WorldObservation extends FeedObservation {
  reality_score: number;
  world_badges: WorldBadge[];
}
export interface WorldSection {
  key: string;
  title: string;
  subtitle: string;
  items: WorldObservation[];
}
export const observeWorldApi = {
  home: () => apiFetch<{ hero: WorldObservation | null; sections: WorldSection[] }>("/observe-world"),
  section: (key: string) =>
    apiFetch<{ key: string; title: string; items: WorldObservation[] }>(`/observe-world/section/${encodeURIComponent(key)}`),
};

// ---- SnapSense™ (24h ephemeral stories) ----
export interface SnapItem {
  id: string; kind: string; media_type: string;
  image_url: string | null; caption: string | null;
  bg_color: string | null; source: string | null; created_at: string;
  visibility?: "public" | "followers" | "private"; expires_at?: string;
  seen?: boolean;
}
export interface SnapGroup {
  user_id: string; nickname: string; avatar_url?: string | null;
  items: SnapItem[]; latest_at: string; has_unseen?: boolean;
}
export const snapSenseApi = {
  list: () => apiFetch<{ groups: SnapGroup[] }>("/snapsenses"),
  create: (payload: { kind?: string; image_base64?: string; caption?: string; bg_color?: string; source?: string; visibility?: "public" | "followers" | "private" }) =>
    apiFetch<SnapItem>("/snapsenses", { method: "POST", body: JSON.stringify(payload) }),
  remove: (id: string) => apiFetch<{ ok: boolean }>(`/snapsenses/${id}`, { method: "DELETE" }),
  seen: (id: string) => apiFetch<{ ok: boolean }>(`/snapsenses/${id}/seen`, { method: "POST" }),
  archive: () => apiFetch<{ items: SnapItem[] }>("/snapsenses/mine/archive"),
  react: (id: string, type: "observed" | "discovery" | "learned") =>
    apiFetch<{ active: boolean; type: string }>(`/snapsenses/${id}/react`, { method: "POST", body: JSON.stringify({ type }) }),
};

// ---- AI narration ----
export interface LiveRecognition {
  recognized: boolean;
  label?: string;
  category?: string;
  subtitle?: string;
  emoji?: string;
  confidence?: number;
  reliability?: "confirmed" | "probable";
  wiki?: string;
}

export const aiApi = {
  explainOpportunity: (title: string, facts: string[], kind?: string) =>
    apiFetch<{ text: string }>("/ai/explain-opportunity", {
      method: "POST", body: JSON.stringify({ title, facts, kind }),
    }),
  curiosity: (facts: string[]) =>
    apiFetch<{ text: string }>("/ai/curiosity", { method: "POST", body: JSON.stringify({ facts }) }),
  explainVisualization: (fields: { label: string; value: string }[]) =>
    apiFetch<{ text: string }>("/ai/explain-visualization", {
      method: "POST", body: JSON.stringify({ fields }),
    }),
  recognizeSubject: (image_base64: string) =>
    apiFetch<{ subject: string; label_it: string }>("/ai/recognize-subject", {
      method: "POST", body: JSON.stringify({ image_base64 }),
    }),
  scene: (image_base64: string) =>
    apiFetch<{ sky_visibility: number | null; scene: string }>("/ai/scene", {
      method: "POST", body: JSON.stringify({ image_base64 }),
    }),
  liveRecognize: (image_base64: string, categories: string[]) =>
    apiFetch<LiveRecognition>("/ai/live-recognize", {
      method: "POST", body: JSON.stringify({ image_base64, categories }),
    }),
  analyzeSatellite: (payload: { location: string; date: string; layer: string; layer_desc: string; notes?: string }) =>
    apiFetch<{ observe: string; explanations: string; cannot: string }>("/ai/analyze-satellite", {
      method: "POST", body: JSON.stringify(payload),
    }),
};

// ---- Feedback (in-app) + Creator Console (developer-only) ----
export type FeedbackType = "suggestion" | "feature" | "bug" | "general";
export type FeedbackStatus = "open" | "in_progress" | "resolved" | "dismissed";

export interface FeedbackItem {
  id: string;
  user_id: string;
  nickname: string;
  type: FeedbackType;
  text: string;
  status: FeedbackStatus;
  priority: number;
  creator_note: string;
  created_at: string;
  updated_at: string;
}

export interface CreatorStats {
  users: number;
  observations: number;
  snapsenses: number;
  feedback: { total: number; open: number; bugs_open: number; by_type: Record<FeedbackType, number> };
  new_users_month: number;
}

export const feedbackApi = {
  create: (type: FeedbackType, text: string) =>
    apiFetch<{ ok: boolean; id: string }>("/feedback", { method: "POST", body: JSON.stringify({ type, text }) }),
  mine: () => apiFetch<{ items: FeedbackItem[]; count: number }>("/feedback/mine"),
};

export const creatorApi = {
  feedback: (type?: string, status?: string) => {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (status) q.set("status", status);
    const qs = q.toString();
    return apiFetch<{ items: FeedbackItem[]; count: number }>(`/creator/feedback${qs ? `?${qs}` : ""}`);
  },
  update: (id: string, data: { status?: FeedbackStatus; priority?: number; creator_note?: string }) =>
    apiFetch<{ ok: boolean }>(`/creator/feedback/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  stats: () => apiFetch<CreatorStats>("/creator/stats"),
};


// ---- Direct Messages (polling) + Senshot condiviso ----
export interface DMUser { id: string; nickname: string; display_name?: string; avatar?: string | null }

export interface ObsSnapshot {
  obs_id: string; user_id: string; nickname?: string; image_url?: string | null;
  subject?: string; caption?: string; ts?: number; lat?: number | null; lon?: number | null;
  sun?: { alt: number; az: number } | null; moon?: { phase: string; illum: number } | null;
  cameraAz?: number; cameraAlt?: number; weather?: { temperature_c?: number } | null; created_at?: string;
}

export interface Conversation {
  id: string; key: string; participants: string[];
  last_message: string; last_at: string; last_sender: string | null;
  other: DMUser; unread: number;
}

export type DMKind = "text" | "image" | "observation" | "profile" | "location" | "link" | "snapsense" | "compare";

export interface DMMessage {
  id: string; conv_id: string; sender_id: string; kind: DMKind;
  text: string; share?: Record<string, unknown> | null; read_by: string[]; created_at: string;
}

export const dmApi = {
  start: (user_id: string) => apiFetch<Conversation>("/conversations", { method: "POST", body: JSON.stringify({ user_id }) }),
  list: () => apiFetch<{ items: Conversation[]; count: number }>("/conversations"),
  messages: (convId: string) => apiFetch<{ items: DMMessage[] }>(`/conversations/${convId}/messages`),
  send: (convId: string, payload: { kind: DMKind; text?: string; share?: Record<string, unknown> }) =>
    apiFetch<DMMessage>(`/conversations/${convId}/messages`, { method: "POST", body: JSON.stringify(payload) }),
  read: (convId: string) => apiFetch<{ ok: boolean }>(`/conversations/${convId}/read`, { method: "POST" }),
  compareAdd: (mid: string, obs_id: string) =>
    apiFetch<{ ok: boolean; share: Record<string, unknown> }>(`/messages/${mid}/compare`, { method: "POST", body: JSON.stringify({ obs_id }) }),
};
