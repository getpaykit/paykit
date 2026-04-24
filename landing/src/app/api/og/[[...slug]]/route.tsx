import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { source } from "@/lib/source";

const WIDTH = 1200;
const HEIGHT = 600;
const PADDING_X = 69;
const PADDING_BOTTOM = 65;

const getPageMeta = (slug?: string[]) => {
  if (!slug || slug.length === 0) {
    return {
      title: "Documentation",
      description: undefined as string | undefined,
    };
  }

  const page = source.getPage(slug);

  if (!page) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
};

export function generateStaticParams() {
  return source.generateParams();
}

type RouteContext = {
  params: Promise<{
    slug?: string[];
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const { title, description } = getPageMeta(slug);

  const { origin } = new URL(request.url);
  const backgroundSrc = `${origin}/og-blank.png`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: "#121212",
        color: "#FAFAFA",
      }}
    >
      <img
        src={backgroundSrc}
        alt=""
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
          left: PADDING_X,
          right: PADDING_X,
          bottom: PADDING_BOTTOM,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontFamily: "Geist",
            fontSize: 72,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            maxWidth: 1000,
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              marginTop: 16,
              fontFamily: "Geist",
              fontSize: 32,
              fontWeight: 400,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              color: "#A1A1A1",
              maxWidth: 780,
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {description}
          </div>
        ) : null}
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
    },
  );
}
