import type { Metadata, Viewport } from "next";

import { ToastProvider } from "@/components/ui";

import "./globals.css";

export const metadata: Metadata = {
  title: "PQ COMMAND",
  description:
    "Internal operating system for PQ Real Estate company-let operations.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PQ COMMAND",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050505",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-[color:var(--pq-accent)] focus:px-3 focus:py-2 focus:text-black"
          href="#main-content"
        >
          Skip to main content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
