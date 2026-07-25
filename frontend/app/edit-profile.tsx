import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable, TextInput, ActivityIndicator, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { authApi, mediaUrl } from "@/src/lib/backend";
import { useAuth } from "@/src/context/AuthContext";
import { ApiError } from "@/src/lib/client";
import { NicknameField } from "@/src/components/NicknameField";

export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuth();

  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [nickOk, setNickOk] = useState(true);
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [links, setLinks] = useState<{ label: string; url: string }[]>(
    [0, 1, 2].map((i) => ({ label: user?.links?.[i]?.label ?? "", url: user?.links?.[i]?.url ?? "" })),
  );
  const [hydrated, setHydrated] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Hydrate fields once the authenticated user is available (e.g. after cold start).
  useEffect(() => {
    if (user && !hydrated) {
      setNickname(user.nickname ?? "");
      setDisplayName(user.display_name ?? "");
      setBio(user.bio ?? "");
      setLinks([0, 1, 2].map((i) => ({ label: user.links?.[i]?.label ?? "", url: user.links?.[i]?.url ?? "" })));
      setHydrated(true);
    }
  }, [user, hydrated]);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  if (!user) {
    return (
      <SpaceBackground>
        <ScreenHeader title="Modifica profilo" />
        <View style={styles.center}><Text style={styles.msg}>Accedi per modificare il profilo.</Text></View>
      </SpaceBackground>
    );
  }

  const isProtected = !!user.protected;
  const avatarUri = mediaUrl(user.avatar);

  const openSettings = () => Alert.alert(
    "Permesso necessario",
    "Consenti l'accesso dalle impostazioni per scegliere una foto.",
    [{ text: "Annulla", style: "cancel" }, { text: "Apri impostazioni", onPress: () => Linking.openSettings() }],
  );

  const pickAvatar = async (fromCamera: boolean) => {
    if (avatarBusy) return;
    // Permission flow (contextual, respects canAskAgain).
    const current = fromCamera
      ? await ImagePicker.getCameraPermissionsAsync()
      : await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      if (current.canAskAgain) {
        const req = fromCamera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        status = req.status;
      }
      if (status !== "granted") { openSettings(); return; }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;

    setAvatarBusy(true);
    setProfileMsg(null);
    try {
      const manip = await ImageManipulator.manipulateAsync(
        result.assets[0].uri, [{ resize: { width: 512 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!manip.base64) throw new Error("no base64");
      const { avatar } = await authApi.updateAvatar(manip.base64);
      setUser({ ...user, avatar });
    } catch (e) {
      setProfileMsg(e instanceof ApiError ? e.message : "Caricamento avatar non riuscito.");
    } finally { setAvatarBusy(false); }
  };

  const saveProfile = async () => {
    if (savingProfile) return;
    setProfileMsg(null);
    const changingNick = !isProtected && nickname.trim() !== user.nickname;
    if (changingNick && !nickOk) { setProfileMsg("Scegli un nickname valido e disponibile."); return; }
    setSavingProfile(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const cleanLinks = links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })).filter((l) => l.url);
      const payload: { bio?: string; nickname?: string; display_name?: string; links?: { label: string; url: string }[] } = { bio, display_name: displayName, links: cleanLinks };
      if (changingNick) payload.nickname = nickname.trim();
      const u = await authApi.updateProfile(payload);
      setUser({ ...user, nickname: u.nickname, author_code: u.author_code ?? user.author_code, bio: u.bio ?? "", display_name: u.display_name ?? "", links: u.links ?? [] });
      setProfileMsg("Profilo aggiornato ✓");
    } catch (e) {
      setProfileMsg(e instanceof ApiError ? e.message : "Salvataggio non riuscito.");
    } finally { setSavingProfile(false); }
  };

  const changePassword = async () => {
    if (pwBusy) return;
    setPwMsg(null); setPwOk(false);
    if (!curPw || !newPw) { setPwMsg("Compila tutti i campi."); return; }
    if (newPw.length < 6) { setPwMsg("La nuova password deve avere almeno 6 caratteri."); return; }
    if (newPw !== confirmPw) { setPwMsg("Le password non coincidono."); return; }
    setPwBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await authApi.changePassword(curPw, newPw);
      setPwOk(true); setPwMsg("Password aggiornata ✓");
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) {
      setPwMsg(e instanceof ApiError ? e.message : "Cambio password non riuscito.");
    } finally { setPwBusy(false); }
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Modifica profilo" />
      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
        testID="edit-profile"
      >
        {/* Avatar */}
        <View style={styles.avatarBlock}>
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} contentFit="cover" transition={150} />
            ) : (
              <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                <Text style={styles.avatarLetter}>{user.nickname[0]?.toUpperCase()}</Text>
              </View>
            )}
            {avatarBusy ? (
              <View style={styles.avatarOverlay}><ActivityIndicator color={colors.brand} /></View>
            ) : null}
          </View>
          <View style={styles.avatarBtns}>
            <Pressable testID="avatar-gallery" style={styles.avatarBtn} onPress={() => pickAvatar(false)} disabled={avatarBusy}>
              <Ionicons name="images-outline" size={16} color={colors.onSurface} />
              <Text style={styles.avatarBtnText}>Galleria</Text>
            </Pressable>
            <Pressable testID="avatar-camera" style={styles.avatarBtn} onPress={() => pickAvatar(true)} disabled={avatarBusy}>
              <Ionicons name="camera-outline" size={16} color={colors.onSurface} />
              <Text style={styles.avatarBtnText}>Fotocamera</Text>
            </Pressable>
          </View>
        </View>

        {/* Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identità</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Nome visualizzato</Text>
            <TextInput testID="edit-display-name" style={styles.input} value={displayName} onChangeText={setDisplayName}
              placeholder="Il tuo nome" placeholderTextColor={colors.onSurfaceSecondary} maxLength={40} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Nickname</Text>
            {isProtected ? (
              <View style={[styles.inputRow, styles.inputLocked]}>
                <TextInput testID="edit-nickname" style={styles.inputFlex} value={nickname} editable={false}
                  autoCapitalize="none" placeholderTextColor={colors.onSurfaceSecondary} />
                <Ionicons name="lock-closed" size={16} color={colors.brand} />
              </View>
            ) : (
              <NicknameField testID="edit-nickname" value={nickname} onChange={setNickname}
                currentNickname={user.nickname} onStatus={setNickOk} />
            )}
            {isProtected ? <Text style={styles.lockHint}>Account protetto · nickname ed email non modificabili</Text> : null}
            {user.author_code ? <Text style={styles.lockHint}>Codice autore permanente: {user.author_code} · resta invariato anche se cambi nickname</Text> : null}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Bio</Text>
            <TextInput testID="edit-bio" style={styles.bioInput} value={bio} onChangeText={setBio} multiline
              placeholder="Scrivi qualcosa su di te…" placeholderTextColor={colors.onSurfaceSecondary} maxLength={280} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Link (fino a 3)</Text>
            {links.map((lk, i) => (
              <View key={i} style={styles.linkRow}>
                <TextInput testID={`edit-link-label-${i}`} style={[styles.input, styles.linkLabel]} value={lk.label}
                  onChangeText={(t) => setLinks((prev) => prev.map((p, j) => (j === i ? { ...p, label: t } : p)))}
                  placeholder="Etichetta" placeholderTextColor={colors.onSurfaceSecondary} maxLength={30} />
                <TextInput testID={`edit-link-url-${i}`} style={[styles.input, styles.linkUrl]} value={lk.url}
                  onChangeText={(t) => setLinks((prev) => prev.map((p, j) => (j === i ? { ...p, url: t } : p)))}
                  placeholder="https://…" placeholderTextColor={colors.onSurfaceSecondary} autoCapitalize="none" keyboardType="url" />
              </View>
            ))}
          </View>
          {profileMsg ? <Text style={[styles.msg, profileMsg.includes("✓") && styles.okMsg]}>{profileMsg}</Text> : null}
          <Pressable testID="save-profile" style={[styles.primary, savingProfile && { opacity: 0.6 }]} onPress={saveProfile} disabled={savingProfile}>
            {savingProfile ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>Salva profilo</Text>}
          </Pressable>
        </View>

        {/* Password */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sicurezza · Cambio password</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Password attuale</Text>
            <TextInput testID="cur-pw" style={styles.input} value={curPw} onChangeText={setCurPw} secureTextEntry
              placeholder="••••••••" placeholderTextColor={colors.onSurfaceSecondary} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Nuova password</Text>
            <TextInput testID="new-pw" style={styles.input} value={newPw} onChangeText={setNewPw} secureTextEntry
              placeholder="Almeno 6 caratteri" placeholderTextColor={colors.onSurfaceSecondary} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Conferma nuova password</Text>
            <TextInput testID="confirm-pw" style={styles.input} value={confirmPw} onChangeText={setConfirmPw} secureTextEntry
              placeholder="Ripeti la nuova password" placeholderTextColor={colors.onSurfaceSecondary} />
          </View>
          {pwMsg ? <Text style={[styles.msg, pwOk && styles.okMsg]}>{pwMsg}</Text> : null}
          <Pressable testID="change-pw" style={[styles.secondary, pwBusy && { opacity: 0.6 }]} onPress={changePassword} disabled={pwBusy}>
            {pwBusy ? <ActivityIndicator color={colors.onSurface} /> : (
              <><Ionicons name="key-outline" size={16} color={colors.onSurface} /><Text style={styles.secondaryText}>Aggiorna password</Text></>
            )}
          </Pressable>
        </View>

        <Pressable testID="done" style={styles.link} onPress={() => router.back()}>
          <Text style={styles.linkText}>Fatto</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  avatarBlock: { alignItems: "center", gap: spacing.md },
  avatarWrap: { width: 108, height: 108, borderRadius: 54, overflow: "hidden", borderWidth: 2, borderColor: colors.brand, backgroundColor: colors.tertiary },
  avatarImg: { width: "100%", height: "100%" },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: colors.brand, fontFamily: fonts.bold, fontSize: 42 },
  avatarOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  avatarBtns: { flexDirection: "row", gap: spacing.md },
  avatarBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  avatarBtnText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  field: { gap: spacing.sm },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm, letterSpacing: 0.5 },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  inputLocked: { opacity: 0.7, borderColor: colors.brand },
  inputFlex: { flex: 1, paddingVertical: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.lg },
  lockHint: { color: colors.brand, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  linkRow: { flexDirection: "row", gap: spacing.sm },
  linkLabel: { flex: 1, fontSize: type.base },
  linkUrl: { flex: 1.4, fontSize: type.base },
  bioInput: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, minHeight: 80, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, textAlignVertical: "top" },
  msg: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.base },
  okMsg: { color: colors.brand },
  primary: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
  primaryText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  secondary: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  secondaryText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
  link: { alignItems: "center", paddingVertical: spacing.sm },
  linkText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base },
});
