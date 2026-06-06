import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { source } from "@/lib/source";

export const revalidate = false;

export function generateStaticParams() {
  return source.generateParams();
}

const ogBlankDataUrl = `data:image/png;base64,${(
  await readFile(join(process.cwd(), "public", "brand", "og-blank.png"))
).toString("base64")}`;

export const GET = async (req: Request, { params }: { params: Promise<{ slug?: string[] }> }) => {
  try {
    let title: string;
    const { slug } = await params;

    if (!slug || slug.length === 0) {
      title = "Documentation";
    } else {
      const page = source.getPage(slug ?? []);
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
      },
    );
  } catch {
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
};
