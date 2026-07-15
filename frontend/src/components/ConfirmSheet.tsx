import React from "react";
import { Modal, StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// OverView-styled confirmation dialog (dark glass, gold accents, clear intent).
export function ConfirmSheet({
  visible, title, message, confirmLabel = "Conferma", cancelLabel = "Annulla",
  destructive = false, icon = "alert-circle", loading = false, onConfirm, onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconWrap, destructive && styles.iconWrapDanger]}>
            <Ionicons name={icon} size={26} color={destructive ? colors.error : colors.brand} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable testID="confirm-cancel" style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable testID="confirm-ok" style={[styles.confirmBtn, destructive && styles.confirmBtnDanger]} onPress={onConfirm} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={destructive ? "#fff" : colors.onBrand} />
              ) : (
                <Text style={[styles.confirmText, destructive && { color: "#fff" }]}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { width: "100%", maxWidth: 360, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", gap: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(212,175,55,0.12)", alignItems: "center", justifyContent: "center" },
  iconWrapDanger: { backgroundColor: "rgba(255,69,58,0.14)" },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl, textAlign: "center" },
  message: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 20 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm, width: "100%" },
  cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.tertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  cancelText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  confirmBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.brand },
  confirmBtnDanger: { backgroundColor: colors.error },
  confirmText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base },
});
