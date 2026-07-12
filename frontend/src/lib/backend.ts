import { apiFetch } from "./client";
import { ObsData } from "./gallery";

export interface AuthUser {
  id: string;
  email?: string;
  nickname: string;
  bio?: string;
  avatar?: string | null;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface FeedObservation {
  id: string;
  user_id: string;
  nickname: string;
  media_type: "image" | "audio" | "video";
  source: "reality" | "listening";
  category: string;
  categories: string[];
  caption: string;
  scientific_value: number;
  image_url: string | null;
  lat?: number | null;
  lon?: number | null;
  data?: ObsData;
  views: number;
  observed: number;
  discovery: number;
  learned: number;
  comments_count: number;
  created_at: string;
  my_interactions: string[];
  author?: { id: string; nickname: string; bio?: string; avatar?: string | null };
}

export interface Profile {
  id: string;
  nickname: string;
  bio: string;
  avatar?: string | null;
  created_at?: string;
  stats: { observations: number; followers: number; following: number };
  is_following: boolean;
  is_me: boolean;
}

export interface Comment {
  id: string; obs_id: string; user_id: string; nickname: string; text: string; created_at: string;
}

export type InteractionType = "observed" | "discovery" | "learned";

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
  updateProfile: (data: { bio?: string; nickname?: string }) =>
    apiFetch<AuthUser>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
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
    image_base64?: string; data?: ObsData;
  }) => apiFetch<FeedObservation>("/observations", {
    method: "POST", body: JSON.stringify(payload),
  }),
  feed: (f: FeedFilters = {}) => {
    const q = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") q.append(k, String(v)); });
    return apiFetch<{ items: FeedObservation[] }>(`/feed?${q.toString()}`);
  },
  observation: (id: string) => apiFetch<FeedObservation>(`/observations/${id}`),
  interact: (id: string, type: InteractionType) =>
    apiFetch<{ active: boolean; type: string; count: number }>(
      `/observations/${id}/interact`, { method: "POST", body: JSON.stringify({ type }) }),
  comments: (id: string) => apiFetch<{ items: Comment[] }>(`/observations/${id}/comments`),
  addComment: (id: string, text: string) =>
    apiFetch<Comment>(`/observations/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) }),
  profile: (id: string) => apiFetch<Profile>(`/users/${id}`),
  userObservations: (id: string) => apiFetch<{ items: FeedObservation[] }>(`/users/${id}/observations`),
  follow: (id: string) => apiFetch<{ following: boolean }>(`/users/${id}/follow`, { method: "POST" }),
  unfollow: (id: string) => apiFetch<{ following: boolean }>(`/users/${id}/follow`, { method: "DELETE" }),
};

// ---- AI narration ----
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
};
