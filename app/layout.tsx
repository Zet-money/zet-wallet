"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { registerServiceWorker, setupInstallPrompt } from "@/lib/pwa";
import { useEffect } from "react";
import { WalletProvider } from "@/contexts/WalletContext";
import { BiometricProvider } from "@/contexts/BiometricContext";
import { UserSettingsProvider } from "@/contexts/UserSettingsContext";
import { visitorTracking } from "@/lib/services/visitor-tracking";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    registerServiceWorker()
    setupInstallPrompt()
    
    // Initialize visitor tracking
    visitorTracking.initialize()
  }, [])
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Zet Wallet" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <BiometricProvider>
            <NetworkProvider>
              <WalletProvider>
                <UserSettingsProvider>
                  {children}
                </UserSettingsProvider>
              </WalletProvider>
            </NetworkProvider>
          </BiometricProvider>
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
