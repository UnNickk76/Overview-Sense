import { apiFetch } from "./client";

export type PresenceLevel = 1 | 2 | 3 | 4;
export type IdentityPref = "name" | "nickname" | "none";

export interface PrivacySettings {
  presence_level: PresenceLevel;
  face_scanned: boolean;
  identity_pref: IdentityPref;
}

export interface DiscoverPerson {
  id: string;
  nickname: string;
  display_name: string;
  avatar?: string | null;
  bio: string;
  reason: string;
  score: number;
}

export interface MentionItem {
  id: string;
  obs_id: string;
  author_nick: string;
  status: string; // pending | accepted_name | accepted_nickname | accepted_none | rejected
  created_at: string;
  image_url: string | null;
  caption?: string | null;
}

export type MentionDecision = "name" | "nickname" | "none" | "reject";

export type NotifKind = "reactions" | "comments" | "follows" | "reposts" | "mentions" | "pulse" | "opportunities";
export type NotifPrefs = Record<NotifKind, boolean>;

export const communityApi = {
  getPrivacy: () => apiFetch<PrivacySettings>("/community/privacy"),
  updatePrivacy: (payload: Partial<PrivacySettings>) =>
    apiFetch<PrivacySettings>("/community/privacy", { method: "PATCH", body: JSON.stringify(payload) }),
  getNotifPrefs: () => apiFetch<NotifPrefs>("/community/notif-prefs"),
  updateNotifPrefs: (prefs: Partial<NotifPrefs>) =>
    apiFetch<NotifPrefs>("/community/notif-prefs", { method: "PATCH", body: JSON.stringify({ prefs }) }),
  discover: (limit = 24) => apiFetch<{ items: DiscoverPerson[] }>(`/community/discover?limit=${limit}`),
  invite: () => apiFetch<{ url: string; code: string; nickname: string; message: string }>("/community/invite"),
  incoming: () => apiFetch<{ items: MentionItem[]; appeared: number; count: number }>("/community/mentions/incoming"),
  summary: () => apiFetch<{ pending: number; appeared: number }>("/community/mentions/summary"),
  respond: (reqId: string, decision: MentionDecision) =>
    apiFetch<{ status: string }>(`/community/mentions/${reqId}/respond`, { method: "POST", body: JSON.stringify({ decision }) }),
  requestMention: (obs_id: string, target_id: string) =>
    apiFetch<{ status: string }>("/community/mentions", { method: "POST", body: JSON.stringify({ obs_id, target_id }) }),
};
