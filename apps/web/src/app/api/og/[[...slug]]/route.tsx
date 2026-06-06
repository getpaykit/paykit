import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { source } from "@/lib/source";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export function generateStaticParams() {
  return [{ slug: [] }, ...source.generateParams()];
}

const ogBlankDataUrl = `data:image/png;base64,${(
  await readFile(join(process.cwd(), "public", "brand", "og-blank.png"))
).toString("base64")}`;

export const GET = async (_req: Request, { params }: { params: Promise<{ slug?: string[] }> }) => {
  let title: string;
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    title = "Documentation";
  } else {
    const page = source.getPage(slug);
    if (!page) notFound();
    title = page.data.title ?? "Documentation";
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: "#121212",
        color: "white",
      }}
    >
      <img
        src={ogBlankDataUrl}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 57,
          left: 65,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <p
          style={{
            fontSize: 72,
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            maxWidth: "400px",
          }}
        >
          {title}
        </p>
      </div>
    </div>,
    {
      width: 1200,
      height: 600,
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400",
      },
    },
  );
};
