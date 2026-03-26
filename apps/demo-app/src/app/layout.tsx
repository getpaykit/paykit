import "@/styles/globals.css";
import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";

import { Toaster } from "sonner";

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: "PayKit Demo",
  description: "Billing sandbox for PayKit",
};

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${fontSans.variable}`}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
