import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, TextInput, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import {
  creatorApi, mediaUrl,
  CreatorStats, SystemHealth, CreatorUser, CreatorSignup, CreatorObs,
  FeedbackItem, FeedbackStatus, FeedbackType,
} from "@/src/lib/backend";

const TYPE_LABEL: Record<FeedbackType, string> = { suggestion: "Suggerimento", feature: "Funzione", bug: "Bug", general: "Generale" };
const STATUS_FLOW: FeedbackStatus[] = ["open", "in_progress", "resolved", "dismissed"];
const STATUS_LABEL: Record<FeedbackStatus, string> = { open: "Aperto", in_progress: "In corso", resolved: "Risolto", dismissed: "Chiuso" };
const STATUS_COLOR: Record<FeedbackStatus, string> = { open: colors.brand, in_progress: colors.blue, resolved: colors.success, dismissed: colors.onSurfaceSecondary };

type TabKey = "overview" | "users" | "signups" | "content" | "feedback";
const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "overview", label: "Panoramica", icon: "stats-chart" },
  { key: "users", label: "Utenti", icon: "people" },
  { key: "signups", label: "Iscrizioni", icon: "person-add" },
  { key: "content", label: "Contenuti", icon: "images" },
  { key: "feedback", label: "Feedback", icon: "chatbubbles" },
];

const FB_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tutti" },
  { key: "bug", label: "Bug" },
  { key: "feature", label: "Funzioni" },
  { key: "suggestion", label: "Idee" },
  { key: "general", label: "Generale" },
];

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return "—";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "ora";
  if (s < 3600) return `${Math.floor(s / 60)}m fa`;
  if (s < 86400) return `${Math.floor(s / 3600)}h fa`;
  return `${Math.floor(s / 86400)}g fa`;
}

function bytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export default function CreatorConsole() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isCreator = user?.role === "developer";
  const [tab, setTab] = useState<TabKey>("overview");

  if (loading) {
    return (
      <SpaceBackground>
        <ScreenHeader title="Creator Console" />
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      </SpaceBackground>
    );
  }

  if (!isCreator) {
    return (
      <SpaceBackground>
        <ScreenHeader title="OverView" />
        <View style={styles.center}>
          <Ionicons name="planet-outline" size={48} color={colors.onSurfaceSecondary} />
          <Text style={styles.dim}>Pagina non disponibile.</Text>
          <Pressable style={styles.cta} onPress={() => router.replace("/home" as never)}>
            <Text style={styles.ctaText}>Torna alla Home</Text>
          </Pressable>
        </View>
      </SpaceBackground>
    );
  }

  return (
    <SpaceBackground>
      <ScreenHeader title="Creator Console" subtitle="Solo per te" />
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Pressable key={t.key} testID={`tab-${t.key}`} style={[styles.tab, on && styles.tabOn]} onPress={() => { Haptics.selectionAsync(); setTab(t.key); }}>
                <Ionicons name={t.icon} size={15} color={on ? colors.onBrand : colors.onSurfaceSecondary} />
                <Text style={[styles.tabText, on && { color: colors.onBrand }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {tab === "overview" && <OverviewPanel />}
      {tab === "users" && <UsersPanel />}
      {tab === "signups" && <SignupsPanel />}
      {tab === "content" && <ContentPanel />}
      {tab === "feedback" && <FeedbackPanel />}
    </SpaceBackground>
  );
}

// ------------------------------------------------------------------ Overview
function OverviewPanel() {
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([creatorApi.stats(), creatorApi.systemHealth()]);
      setStats(s); setHealth(h);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {loading && !stats ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} /> : null}
      {stats ? (
        <View style={styles.statsGrid}>
          <StatBox icon="people" label="Utenti" value={stats.users} />
          <StatBox icon="camera" label="Senshot" value={stats.observations} />
          <StatBox icon="flash" label="SnapSense" value={stats.snapsenses} />
          <StatBox icon="mail-unread" label="Feedback aperti" value={stats.feedback.open} accent={colors.brand} />
          <StatBox icon="bug" label="Bug attivi" value={stats.feedback.bugs_open} accent={stats.feedback.bugs_open > 0 ? colors.error : undefined} />
          <StatBox icon="trending-up" label="Nuovi (mese)" value={stats.new_users_month} />
        </View>
      ) : null}

      {health ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sectionTitle}>Salute del sistema</Text>
          <View style={styles.healthRow}>
            <HealthPill label="Backend" ok={health.backend === "online"} value={health.backend} />
            <HealthPill label="Database" ok={health.database === "online"} value={health.database} />
            <HealthPill label="Build" ok value={health.build_version} neutral />
          </View>
          <View style={styles.card}>
            <HealthLine icon="images" label="Immagini archiviate" value={`${health.storage.images}`} />
            <HealthLine icon="server" label="Spazio media" value={bytes(health.storage.media_bytes)} />
            <HealthLine icon="cube" label="Dati DB" value={bytes(health.storage.db_data_bytes)} />
            <HealthLine icon="pause-circle" label="Utenti sospesi" value={`${health.suspended}`} warn={health.suspended > 0} />
            <HealthLine icon="alert-circle" label="Pubblicazioni fallite" value={`${health.failed_publications}`} warn={health.failed_publications > 0} />
            <HealthLine icon="ban" label="Pulse vuoti" value={`${health.empty_pulses}`} warn={health.empty_pulses > 0} />
            <HealthLine icon="bug" label="Bug aperti" value={`${health.bugs_open}`} warn={health.bugs_open > 0} last />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

// --------------------------------------------------------------------- Users
function UsersPanel() {
  const [items, setItems] = useState<CreatorUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<CreatorUser | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try { const r = await creatorApi.users(q); setItems(r.items); setTotal(r.total); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(query); }, [load, query]));

  const onAction = async () => { setTarget(null); await load(query); };

  return (
    <>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.onSurfaceSecondary} />
        <TextInput testID="user-search" style={styles.searchInput} value={query} onChangeText={setQuery}
          placeholder="Cerca per nickname, email o codice…" placeholderTextColor={colors.onSurfaceSecondary} autoCapitalize="none" />
        {query ? <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={16} color={colors.onSurfaceSecondary} /></Pressable> : null}
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {loading && items.length === 0 ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} /> : null}
        {!loading ? <Text style={styles.countHint}>{items.length} di {total} utenti</Text> : null}
        {items.map((u) => (
          <Pressable key={u.id} testID={`user-${u.id}`} style={styles.card} onPress={() => setTarget(u)}>
            <View style={styles.rowBetween}>
              <View style={styles.avatarWrap}>
                {u.suspension ? <View style={styles.suspDot} /> : null}
                <Text style={styles.userNick}>@{u.nickname}</Text>
                {u.author_code ? <View style={styles.codeTag}><Text style={styles.codeTagText}>{u.author_code}</Text></View> : null}
                {u.protected ? <Ionicons name="shield-checkmark" size={13} color={colors.brand} /> : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} />
            </View>
            <View style={styles.metaRow}>
              <MetaChip icon="camera-outline" value={u.counts.senseshot} />
              <MetaChip icon="flash-outline" value={u.counts.pulse} />
              <MetaChip icon="chatbubble-ellipses-outline" value={u.counts.feedback} />
              <Text style={styles.metaTime}>iscritto {timeAgo(u.created_at)}</Text>
            </View>
            {u.suspension ? <Text style={styles.suspInline}>⏸ Sospeso · {u.suspension.reason}</Text> : null}
          </Pressable>
        ))}
        {!loading && items.length === 0 ? <Text style={styles.dim}>Nessun utente trovato.</Text> : null}
      </ScrollView>
      {target ? <UserDetailModal user={target} onClose={() => setTarget(null)} onAction={onAction} /> : null}
    </>
  );
}

function UserDetailModal({ user, onClose, onAction }: { user: CreatorUser; onClose: () => void; onAction: () => void }) {
  const [mode, setMode] = useState<"view" | "suspend">("view");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doSuspend = async () => {
    if (reason.trim().length < 3) { setErr("Indica una motivazione (min 3 caratteri)."); return; }
    setBusy(true); setErr("");
    try {
      await creatorApi.suspend(user.id, reason.trim(), days ?? undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAction();
    } catch (e) { setErr((e as Error).message || "Errore durante la sospensione."); setBusy(false); }
  };
  const doUnsuspend = async () => {
    setBusy(true); setErr("");
    try { await creatorApi.unsuspend(user.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onAction(); }
    catch (e) { setErr((e as Error).message || "Errore."); setBusy(false); }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.rowBetween}>
            <Text style={styles.modalTitle}>@{user.nickname}</Text>
            <Pressable testID="user-modal-close" onPress={onClose}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
          </View>
          <Text style={styles.modalSub}>{user.author_code ? `#${user.author_code} · ` : ""}{user.email || "—"}</Text>

          <View style={styles.detailGrid}>
            <DetailBox label="Senshot" value={user.counts.senseshot} />
            <DetailBox label="Pulse" value={user.counts.pulse} />
            <DetailBox label="Feedback" value={user.counts.feedback} />
          </View>
          <Text style={styles.modalMeta}>Iscritto {timeAgo(user.created_at)} · Ultimo accesso {timeAgo(user.last_login)}{user.platform ? ` · ${user.platform}` : ""}</Text>

          {user.suspension ? (
            <View style={styles.suspBox}>
              <Text style={styles.suspTitle}>⏸ Account sospeso (sola lettura)</Text>
              <Text style={styles.suspReason}>{user.suspension.reason}</Text>
              <Text style={styles.suspMeta}>{user.suspension.until ? `Fino al ${new Date(user.suspension.until).toLocaleDateString("it-IT")}` : "Durata indefinita"}</Text>
            </View>
          ) : null}

          {err ? <Text style={styles.errText}>{err}</Text> : null}

          {user.protected ? (
            <Text style={styles.dim}>Account protetto: non sospendibile.</Text>
          ) : mode === "view" ? (
            user.suspension ? (
              <Pressable testID="user-unsuspend" style={[styles.actionBtn, { backgroundColor: colors.success }]} disabled={busy} onPress={doUnsuspend}>
                {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.actionText}>Riattiva account</Text>}
              </Pressable>
            ) : (
              <Pressable testID="user-suspend-open" style={[styles.actionBtn, { backgroundColor: colors.error }]} onPress={() => setMode("suspend")}>
                <Text style={[styles.actionText, { color: "#fff" }]}>Sospendi (sola lettura)</Text>
              </Pressable>
            )
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.fieldLabel}>Motivazione (mostrata all'utente)</Text>
              <TextInput testID="suspend-reason" style={styles.reasonInput} value={reason} onChangeText={setReason} multiline
                placeholder="Es. violazione delle linee guida sui contenuti…" placeholderTextColor={colors.onSurfaceSecondary} />
              <Text style={styles.fieldLabel}>Durata</Text>
              <View style={styles.durRow}>
                {[{ l: "Indefinita", v: null }, { l: "1 giorno", v: 1 }, { l: "7 giorni", v: 7 }, { l: "30 giorni", v: 30 }].map((d) => {
                  const on = days === d.v;
                  return (
                    <Pressable key={d.l} style={[styles.durChip, on && styles.durOn]} onPress={() => setDays(d.v)}>
                      <Text style={[styles.durText, on && { color: colors.onBrand }]}>{d.l}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable testID="suspend-confirm" style={[styles.actionBtn, { backgroundColor: colors.error, flex: 1 }]} disabled={busy} onPress={doSuspend}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.actionText, { color: "#fff" }]}>Conferma sospensione</Text>}
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.ghostBtn]} onPress={() => { setMode("view"); setErr(""); }}>
                  <Text style={styles.ghostText}>Annulla</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ------------------------------------------------------------------- Signups
function SignupsPanel() {
  const [items, setItems] = useState<CreatorSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await creatorApi.signups()).items); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {loading && items.length === 0 ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} /> : null}
      <Text style={styles.sectionTitle}>Iscrizioni recenti</Text>
      {items.map((s) => (
        <View key={s.id} style={styles.signupRow}>
          <View style={styles.signupIcon}><Text style={styles.signupCode}>{s.author_code || "?"}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userNick}>@{s.nickname}</Text>
            <Text style={styles.metaTime}>{timeAgo(s.created_at)}{s.platform ? ` · ${s.platform}` : ""}{s.last_login ? ` · attivo ${timeAgo(s.last_login)}` : ""}</Text>
          </View>
          {s.suspended ? <View style={styles.suspBadge}><Text style={styles.suspBadgeText}>Sospeso</Text></View> : null}
        </View>
      ))}
      {!loading && items.length === 0 ? <Text style={styles.dim}>Nessuna iscrizione.</Text> : null}
    </ScrollView>
  );
}

// ------------------------------------------------------------------- Content
function ContentPanel() {
  const [items, setItems] = useState<CreatorObs[]>([]);
  const [ftype, setFtype] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (t: string, q: string) => {
    setLoading(true);
    try { setItems((await creatorApi.observations(q, t)).items); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(ftype, query); }, [load, ftype, query]));

  return (
    <>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.onSurfaceSecondary} />
        <TextInput testID="content-search" style={styles.searchInput} value={query} onChangeText={setQuery}
          placeholder="Cerca contenuti…" placeholderTextColor={colors.onSurfaceSecondary} autoCapitalize="none" />
      </View>
      <View style={styles.filterRow}>
        {[{ k: "", l: "Tutti" }, { k: "senseshot", l: "Senshot" }, { k: "pulse", l: "Pulse" }].map((f) => {
          const on = ftype === f.k;
          return (
            <Pressable key={f.k || "all"} style={[styles.filterChip, on && styles.filterOn]} onPress={() => setFtype(f.k)}>
              <Text style={[styles.filterText, on && { color: colors.onBrand }]}>{f.l}</Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {loading && items.length === 0 ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} /> : null}
        <View style={styles.grid}>
          {items.map((o) => {
            const uri = mediaUrl(o.image_url, "thumb");
            return (
              <View key={o.id} style={styles.gridCell}>
                {uri ? <Image source={{ uri }} style={styles.gridImg} contentFit="cover" /> : <View style={[styles.gridImg, styles.gridEmpty]}><Ionicons name="image-outline" size={20} color={colors.onSurfaceSecondary} /></View>}
                {o.is_pulse ? <View style={styles.pulseTag}><Ionicons name="flash" size={9} color={colors.onBrand} /></View> : null}
                <Text style={styles.gridNick} numberOfLines={1}>@{o.nickname}</Text>
                <Text style={styles.gridMeta} numberOfLines={1}>{o.code || o.category || "—"}</Text>
              </View>
            );
          })}
        </View>
        {!loading && items.length === 0 ? <Text style={styles.dim}>Nessun contenuto.</Text> : null}
      </ScrollView>
    </>
  );
}

// ------------------------------------------------------------------ Feedback
function FeedbackPanel() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const load = useCallback(async (f: string) => {
    setLoading(true);
    try { setItems((await creatorApi.feedback(f || undefined)).items); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(filter); }, [load, filter]));

  const cycleStatus = async (f: FeedbackItem) => {
    const next = STATUS_FLOW[(STATUS_FLOW.indexOf(f.status) + 1) % STATUS_FLOW.length];
    Haptics.selectionAsync();
    setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: next } : x)));
    try { await creatorApi.update(f.id, { status: next }); } catch { load(filter); }
  };
  const setPriority = async (f: FeedbackItem, p: number) => {
    Haptics.selectionAsync();
    setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, priority: p } : x)));
    try { await creatorApi.update(f.id, { priority: p }); } catch { load(filter); }
  };
  const saveNote = async (f: FeedbackItem) => {
    try { await creatorApi.update(f.id, { creator_note: noteText }); } catch { /* ignore */ }
    setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, creator_note: noteText } : x)));
    setNoteFor(null); setNoteText("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.filterRow}>
        {FB_FILTERS.map((fl) => {
          const on = filter === fl.key;
          return (
            <Pressable key={fl.key || "all"} testID={`filter-${fl.key || "all"}`} style={[styles.filterChip, on && styles.filterOn]} onPress={() => setFilter(fl.key)}>
              <Text style={[styles.filterText, on && { color: colors.onBrand }]}>{fl.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {loading && items.length === 0 ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} /> : null}
      {items.length === 0 && !loading ? (
        <Text style={styles.dim}>Nessun feedback per questo filtro.</Text>
      ) : items.map((f) => (
        <View key={f.id} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.typeTag}><Text style={styles.typeTagText}>{TYPE_LABEL[f.type]}</Text></View>
            <Pressable testID={`status-${f.id}`} style={[styles.statusBtn, { borderColor: STATUS_COLOR[f.status] }]} onPress={() => cycleStatus(f)}>
              <View style={[styles.dot, { backgroundColor: STATUS_COLOR[f.status] }]} />
              <Text style={[styles.statusBtnText, { color: STATUS_COLOR[f.status] }]}>{STATUS_LABEL[f.status]}</Text>
            </Pressable>
          </View>
          <Text style={styles.author}>@{f.nickname}</Text>
          <Text style={styles.text}>{f.text}</Text>
          <View style={styles.prioRow}>
            <Text style={styles.prioLabel}>Priorità</Text>
            {[0, 1, 2, 3].map((p) => (
              <Pressable key={p} onPress={() => setPriority(f, p)} style={[styles.prioBtn, f.priority === p && styles.prioOn]}>
                <Text style={[styles.prioText, f.priority === p && { color: colors.onBrand }]}>{p === 0 ? "—" : p}</Text>
              </Pressable>
            ))}
          </View>
          {noteFor === f.id ? (
            <View style={{ gap: spacing.sm }}>
              <TextInput testID={`note-input-${f.id}`} style={styles.noteInput} value={noteText} onChangeText={setNoteText} multiline
                placeholder="Nota / risposta pubblica all'utente…" placeholderTextColor={colors.onSurfaceSecondary} />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable style={styles.noteSave} onPress={() => saveNote(f)}><Text style={styles.noteSaveText}>Salva nota</Text></Pressable>
                <Pressable style={styles.noteCancel} onPress={() => { setNoteFor(null); setNoteText(""); }}><Text style={styles.noteCancelText}>Annulla</Text></Pressable>
              </View>
            </View>
          ) : (
            <Pressable testID={`add-note-${f.id}`} style={styles.noteBtn} onPress={() => { setNoteFor(f.id); setNoteText(f.creator_note || ""); }}>
              <Ionicons name="create-outline" size={14} color={colors.blue} />
              <Text style={styles.noteBtnText}>{f.creator_note ? "Modifica nota" : "Aggiungi nota"}</Text>
            </Pressable>
          )}
          {f.creator_note && noteFor !== f.id ? <Text style={styles.creatorNote}>↳ {f.creator_note}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

// ------------------------------------------------------------------ Reusable
function StatBox({ icon, label, value, accent }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; accent?: string }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={18} color={accent ?? colors.onSurfaceSecondary} />
      <Text style={[styles.statVal, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function HealthPill({ label, value, ok, neutral }: { label: string; value: string; ok: boolean; neutral?: boolean }) {
  const c = neutral ? colors.onSurfaceSecondary : ok ? colors.success : colors.error;
  return (
    <View style={styles.healthPill}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={styles.healthPillLabel}>{label}</Text>
      <Text style={[styles.healthPillVal, { color: c }]}>{value}</Text>
    </View>
  );
}
function HealthLine({ icon, label, value, warn, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; warn?: boolean; last?: boolean }) {
  return (
    <View style={[styles.healthLine, !last && styles.healthLineBorder]}>
      <Ionicons name={icon} size={15} color={warn ? colors.warning : colors.onSurfaceSecondary} />
      <Text style={styles.healthLineLabel}>{label}</Text>
      <Text style={[styles.healthLineVal, warn && { color: colors.warning }]}>{value}</Text>
    </View>
  );
}
function MetaChip({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: number }) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={12} color={colors.onSurfaceSecondary} />
      <Text style={styles.metaChipText}>{value}</Text>
    </View>
  );
}
function DetailBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailVal}>{value}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  dim: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", marginTop: spacing.md },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },

  tabBar: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tabRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tabOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },

  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 48 },
  countHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statBox: { width: "31.5%", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statVal: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  statLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, textAlign: "center" },

  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },

  healthRow: { flexDirection: "row", gap: spacing.sm },
  healthPill: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  healthPillLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 2 },
  healthPillVal: { fontFamily: fonts.semibold, fontSize: type.sm - 1, marginLeft: "auto" },
  healthLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  healthLineBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  healthLineLabel: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, flex: 1 },
  healthLineVal: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm },

  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, padding: 0 },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatarWrap: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  suspDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },
  userNick: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  codeTag: { backgroundColor: colors.tertiary, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
  codeTagText: { color: colors.brand, fontFamily: fonts.mono, fontSize: type.sm - 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaChipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1 },
  metaTime: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginLeft: "auto" },
  suspInline: { color: colors.error, fontFamily: fonts.regular, fontSize: type.sm - 1 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surfaceTertiary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  modalTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  modalSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm },
  detailGrid: { flexDirection: "row", gap: spacing.sm },
  detailBox: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", gap: 2 },
  detailVal: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.lg },
  detailLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2 },
  modalMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  suspBox: { backgroundColor: "rgba(255,69,58,0.12)", borderRadius: radius.md, padding: spacing.md, gap: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.error },
  suspTitle: { color: colors.error, fontFamily: fonts.semibold, fontSize: type.sm },
  suspReason: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base },
  suspMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  errText: { color: colors.error, fontFamily: fonts.regular, fontSize: type.sm },
  actionBtn: { borderRadius: radius.pill, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  actionText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  ghostBtn: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: spacing.lg },
  ghostText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.base },
  fieldLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  reasonInput: { minHeight: 66, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, padding: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, textAlignVertical: "top", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  durRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  durChip: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  durOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  durText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },

  signupRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  signupIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center" },
  signupCode: { color: colors.brand, fontFamily: fonts.mono, fontSize: type.sm },
  suspBadge: { backgroundColor: "rgba(255,69,58,0.15)", borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  suspBadgeText: { color: colors.error, fontFamily: fonts.semibold, fontSize: type.sm - 2 },

  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  filterChip: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  filterOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridCell: { width: "31.5%", gap: 3 },
  gridImg: { width: "100%", aspectRatio: 1, borderRadius: radius.sm, backgroundColor: colors.tertiary },
  gridEmpty: { alignItems: "center", justifyContent: "center" },
  pulseTag: { position: "absolute", top: 5, right: 5, backgroundColor: colors.brand, borderRadius: 8, width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  gridNick: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 2 },
  gridMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 3 },

  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeTag: { backgroundColor: colors.tertiary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  typeTagText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 2 },
  statusBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusBtnText: { fontFamily: fonts.semibold, fontSize: type.sm - 1 },
  author: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1 },
  text: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20 },
  prioRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  prioLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  prioBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.tertiary },
  prioOn: { backgroundColor: colors.brand },
  prioText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm },
  noteBtn: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" },
  noteBtnText: { color: colors.blue, fontFamily: fonts.medium, fontSize: type.sm },
  noteInput: { minHeight: 60, backgroundColor: colors.tertiary, borderRadius: radius.sm, padding: spacing.sm, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm, textAlignVertical: "top" },
  noteSave: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  noteSaveText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm },
  noteCancel: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  noteCancelText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  creatorNote: { color: colors.blue, fontFamily: fonts.regular, fontSize: type.sm - 1, fontStyle: "italic" },
});
