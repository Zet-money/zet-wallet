import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { WalletProvider } from "@/contexts/WalletContext";
import { BiometricProvider } from "@/contexts/BiometricContext";
import { UserSettingsProvider } from "@/contexts/UserSettingsContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { SplashProvider } from "@/contexts/SplashContext";
import { GlobalNotificationHandler } from "@/components/GlobalNotificationHandler";
import AppInitializer from "@/components/AppInitializer";
import { metadata } from "./metadata";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export { metadata };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppInitializer>
            <SplashProvider>
              <BiometricProvider>
                <NetworkProvider>
                  <WalletProvider>
                    <UserSettingsProvider>
                      <NotificationProvider>
                        <GlobalNotificationHandler />
                        {children}
                      </NotificationProvider>
                    </UserSettingsProvider>
                  </WalletProvider>
                </NetworkProvider>
              </BiometricProvider>
            </SplashProvider>
          </AppInitializer>
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
