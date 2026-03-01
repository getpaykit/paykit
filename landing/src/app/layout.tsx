import "@/styles/globals.css";

import { Analytics } from "@vercel/analytics/next";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HeaderSection } from "@/components/sections/header-section";

export const metadata: Metadata = {
  title: "PayKit",
  description: "Payments orchestration for modern SaaS.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} dark`}
      suppressHydrationWarning
    >
      <body>
        <RootProvider theme={{ defaultTheme: "dark" }}>
          <HeaderSection />
          {children}
          <Analytics />
        </RootProvider>
      </body>
    </html>
  );
}
