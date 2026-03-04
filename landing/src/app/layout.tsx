import { GeistPixelSquare } from "geist/font/pixel";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { OG_URL } from "@/lib/consts";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const title = "PayKit — Open-source payment orchestration for TypeScript";
const description =
  "Open-source TypeScript payment toolkit that unifies multiple payment providers behind a single, extensible API.";

export const metadata: Metadata = {
  metadataBase: new URL(OG_URL),
  title: { template: "%s | PayKit", default: title },
  description,
  openGraph: {
    type: "website",
    url: OG_URL,
    siteName: "PayKit",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon/favicon.ico" sizes="any" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon/favicon-16x16.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/favicon/light/apple-touch-icon.png"
        />
        <link rel="manifest" href="/favicon/light/site.webmanifest" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
                    try {
                      if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                        document.querySelector('meta[name="theme-color"]').setAttribute('content')
                      }
                    } catch (_) {}
                  `,
          }}
        />
      </head>
      <body
        className={`${fontSans.variable} ${fontMono.variable} ${GeistPixelSquare.variable} font-sans antialiased overflow-x-hidden`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
