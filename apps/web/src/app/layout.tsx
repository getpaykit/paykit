import "@/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

export const metadata: Metadata = {
  title: "PayKit",
  description: "Payments orchestration for modern SaaS.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fontSans.variable} dark`}>
      <body>{children}</body>
    </html>
  );
}
