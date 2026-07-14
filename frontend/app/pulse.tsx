import React from "react";
import { Redirect } from "expo-router";

// Pulse™ now lives inside the Challenges™ hub.
export default function PulseRedirect() {
  return <Redirect href="/challenges" />;
}
