"use client";

import { useEffect } from "react";
import { registerServiceWorker, setupInstallPrompt } from "@/lib/pwa";
import { visitorTracking } from "@/lib/services/visitor-tracking";

interface AppInitializerProps {
  children: React.ReactNode;
}

export default function AppInitializer({ children }: AppInitializerProps) {
  useEffect(() => {
    registerServiceWorker();
    setupInstallPrompt();
    
    // Initialize visitor tracking
    visitorTracking.initialize();
  }, []);

  return <>{children}</>;
}
