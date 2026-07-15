import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { registerForPush } from "@/src/lib/push";

// Bridges push notifications to the app: registers the device once the user is
// known, and routes taps to the relevant screen (e.g. Match History™).
export function PushBridge() {
  const { user } = useAuth();
  const router = useRouter();
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (user?.id && done.current !== user.id) {
      done.current = user.id;
      registerForPush(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const url = resp.notification.request.content.data?.action_url;
      if (typeof url === "string" && url.startsWith("/")) router.push(url as never);
    });
    return () => sub.remove();
  }, [router]);

  return null;
}
