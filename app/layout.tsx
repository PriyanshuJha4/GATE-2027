import "./globals.css";
import type { Metadata, Viewport } from "next";
import Sidebar from "@/components/Sidebar";
import { UserProvider } from "@/components/UserContext";
import PwaRegister from "@/components/PwaRegister";
import ImpersonationBanner from "@/components/ImpersonationBanner";

export const metadata: Metadata = {
  title: "GATE 2027 Dashboard",
  description: "GATE 2027 Study Roadmap & Performance Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GATE 2027",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f4e79",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen m-0 p-0 antialiased">
        <UserProvider>
          {/* PWA Service Worker Registration */}
          <PwaRegister />

          {/* Admin Impersonation Top Switcher Banner */}
          <ImpersonationBanner />

          {/* Top Header bar with Hamburger Navigation */}
          <Sidebar />

          {/* Full Screen Content Container */}
          <main className="w-full min-h-screen px-4 py-5 sm:px-6 md:px-8 max-w-5xl mx-auto">
            {children}
          </main>
        </UserProvider>
      </body>
    </html>
  );
}