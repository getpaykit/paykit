import { ImageResponse } from "next/og";

import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, URLs } from "@/lib/consts";

export const alt = SITE_TITLE;
export const contentType = "image/png";
export const size = {
  width: 1200,
  height: 630,
};

const featureChips = ["Checkout", "Payment Methods", "Charges", "Webhooks"];

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background:
          "linear-gradient(145deg, rgb(247, 244, 237) 0%, rgb(239, 236, 229) 52%, rgb(231, 228, 220) 100%)",
        color: "#111827",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          backgroundImage:
            "linear-gradient(rgba(17,24,39,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(17,24,39,0.06) 1px, transparent 1px)",
          backgroundPosition: "0 0, 0 0",
          backgroundSize: "32px 32px",
          inset: 0,
          opacity: 0.35,
          position: "absolute",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          height: "100%",
          justifyContent: "space-between",
          padding: "54px 58px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "rgba(17,24,39,0.06)",
              border: "1px solid rgba(17,24,39,0.08)",
              borderRadius: 999,
              display: "flex",
              fontSize: 18,
              fontWeight: 600,
              gap: 10,
              letterSpacing: "0.22em",
              padding: "10px 16px",
              textTransform: "uppercase",
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              color: "rgba(17,24,39,0.56)",
              display: "flex",
              fontSize: 20,
              fontWeight: 500,
            }}
          >
            {URLs.site.replace("https://", "")}
          </div>
        </div>

        <div
          style={{
            alignItems: "stretch",
            display: "flex",
            gap: 28,
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "space-between",
              paddingTop: 8,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div
                style={{
                  color: "rgba(17,24,39,0.44)",
                  display: "flex",
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                Payment Orchestration
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 72,
                  fontWeight: 700,
                  letterSpacing: "-0.07em",
                  lineHeight: 0.95,
                }}
              >
                <span>{SITE_NAME} keeps the</span>
                <span>provider edge small.</span>
              </div>
              <div
                style={{
                  color: "rgba(17,24,39,0.72)",
                  display: "flex",
                  fontSize: 28,
                  lineHeight: 1.35,
                  maxWidth: 650,
                }}
              >
                {SITE_DESCRIPTION}
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#101828",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 28,
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
              display: "flex",
              flexDirection: "column",
              gap: 18,
              minWidth: 380,
              padding: 28,
            }}
          >
            <div
              style={{
                alignItems: "center",
                color: "rgba(226,232,240,0.7)",
                display: "flex",
                fontSize: 18,
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <span>paykit.ts</span>
              <span>ts</span>
            </div>
            <div
              style={{
                color: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 21,
                gap: 8,
                lineHeight: 1.45,
              }}
            >
              <div style={{ display: "flex" }}>
                <span>createPayKit({`{`}</span>
              </div>
              <div style={{ display: "flex" }}>
                <span style={{ color: "#8b5cf6" }}> database</span>
                <span style={{ color: "#94a3b8" }}>: pool,</span>
              </div>
              <div style={{ display: "flex" }}>
                <span style={{ color: "#8b5cf6" }}> providers</span>
                <span style={{ color: "#94a3b8" }}>: [stripe(), paypal()],</span>
              </div>
              <div style={{ display: "flex" }}>
                <span style={{ color: "#8b5cf6" }}> on</span>
                <span style={{ color: "#94a3b8" }}>
                  : {`{`} ... {`}`},
                </span>
              </div>
              <div style={{ display: "flex" }}>
                <span>{`}`})</span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 14,
            width: "100%",
          }}
        >
          {featureChips.map((chip) => (
            <div
              key={chip}
              style={{
                alignItems: "center",
                background: "rgba(17,24,39,0.06)",
                border: "1px solid rgba(17,24,39,0.08)",
                borderRadius: 999,
                color: "rgba(17,24,39,0.8)",
                display: "flex",
                fontSize: 20,
                fontWeight: 600,
                padding: "10px 18px",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    </div>,
    size,
  );
}
