import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { apiFetch } from "./client";

// Foreground presentation for incoming pushes.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Register this device for Emergent-managed push, keyed by the user's id.
// Silently no-ops on web / Expo Go / simulators — only works on a native build
// with a real EMERGENT_PUSH_KEY + google-services.json.
export async function registerForPush(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "OverView", importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const token = await Notifications.getDevicePushTokenAsync();
    await apiFetch("/register-push", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, platform: Platform.OS, device_token: String(token.data) }),
    });
  } catch {
    /* push unavailable in this environment */
  }
}
