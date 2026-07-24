import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { LangProvider } from "@/src/context/LangContext";
import { PushBridge } from "@/src/components/PushBridge";
import { flushPendingPublishes } from "@/src/lib/pendingPublish";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    Geist: require("@/assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("@/assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("@/assets/fonts/Geist-SemiBold.ttf"),
    "Geist-Bold": require("@/assets/fonts/Geist-Bold.ttf"),
    GeistMono: require("@/assets/fonts/GeistMono-Regular.ttf"),
    "GeistMono-Medium": require("@/assets/fonts/GeistMono-Medium.ttf"),
  });

  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Auto-publish any Sense queued while offline — on launch and each time the app
  // returns to the foreground. The user must never lose content.
  useEffect(() => {
    flushPendingPublishes().catch(() => {});
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") flushPendingPublishes().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <BottomSheetModalProvider>
            <AuthProvider>
              <LangProvider>
                <StatusBar style="light" />
                <PushBridge />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: "#000000" },
                    animation: "fade",
                  }}
                />
              </LangProvider>
            </AuthProvider>
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
