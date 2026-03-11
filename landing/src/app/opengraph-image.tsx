import { ImageResponse } from "next/og";

import { SITE_NAME, SITE_TITLE, URLs } from "@/lib/consts";

export const alt = SITE_TITLE;
export const contentType = "image/png";
export const size = {
  width: 1200,
  height: 630,
};

const theme = {
  background: "#09090b",
  backgroundSoft: "#111113",
  card: "#18181b",
  cardSoft: "#202024",
  foreground: "#fafafa",
  muted: "#a1a1aa",
  mutedSoft: "rgba(250, 250, 250, 0.7)",
  border: "rgba(255, 255, 255, 0.1)",
  borderSoft: "rgba(255, 255, 255, 0.06)",
  borderStrong: "rgba(255, 255, 255, 0.16)",
  blue: "#60a5fa",
  blueSoft: "rgba(96, 165, 250, 0.12)",
  green: "#4ade80",
  greenSoft: "rgba(74, 222, 128, 0.12)",
  yellow: "#facc15",
  yellowSoft: "rgba(250, 204, 21, 0.12)",
  red: "#f87171",
  redSoft: "rgba(248, 113, 113, 0.12)",
} as const;

const featurePills = [
  {
    label: "Unified API",
    color: theme.blue,
    border: "rgba(96, 165, 250, 0.28)",
    background: theme.blueSoft,
  },
  {
    label: "Subscriptions",
    color: theme.green,
    border: "rgba(74, 222, 128, 0.28)",
    background: theme.greenSoft,
  },
  {
    label: "Checkout",
    color: theme.yellow,
    border: "rgba(250, 204, 21, 0.24)",
    background: theme.yellowSoft,
  },
  {
    label: "Webhooks",
    color: theme.red,
    border: "rgba(248, 113, 113, 0.24)",
    background: theme.redSoft,
  },
] as const;

const providerCards = [
  {
    label: "Provider",
    name: "Stripe",
    description: "Hosted checkout",
    color: theme.blue,
    border: "rgba(96, 165, 250, 0.28)",
    background: theme.blueSoft,
  },
  {
    label: "Provider",
    name: "PayPal",
    description: "Billing plans",
    color: theme.yellow,
    border: "rgba(250, 204, 21, 0.24)",
    background: theme.yellowSoft,
  },
  {
    label: "Provider",
    name: "PSPs",
    description: "Regional rails",
    color: theme.green,
    border: "rgba(74, 222, 128, 0.24)",
    background: theme.greenSoft,
  },
] as const;

function BrandMark({
  width,
  height,
  color,
  opacity = 1,
}: {
  width: number;
  height: number;
  color: string;
  opacity?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 577 577"
      fill="none"
      style={{ display: "flex", opacity }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M117.86 237.013C117.861 236.244 118.694 235.763 119.36 236.148L231.344 300.798C234.438 302.584 236.344 305.885 236.344 309.458L236.348 576.588L117.86 508.178V501.828C117.86 498.85 117.859 495.26 117.859 491.214C117.859 479.26 117.859 463.322 117.859 447.385C117.86 415.587 117.86 383.787 117.86 383.632V237.013Z"
        fill={color}
      />
      <path
        d="M243.844 3.34936C251.579 -1.11646 261.109 -1.11646 268.844 3.34936L500.188 136.916C507.922 141.382 512.688 149.635 512.688 158.566V425.699C512.687 434.63 507.922 442.884 500.188 447.349L276.348 576.583L276.347 486.681L424.821 400.961C431.009 397.388 434.826 390.784 434.826 383.632V200.642C434.826 193.473 430.994 186.877 424.821 183.313L266.349 91.8191L265.765 91.4949C259.885 88.3562 252.815 88.3496 246.924 91.4939L246.338 91.8191L87.8652 183.313C81.6757 186.887 77.8605 193.492 77.8604 200.642V418.166C77.8601 427.234 77.8595 437.31 77.8594 447.385C77.8592 460.731 77.8593 474.077 77.8594 485.084L12.5 447.349C4.76516 442.884 0.000152081 434.63 0 425.699V158.566C0 149.635 4.76517 141.382 12.5 136.916L243.844 3.34936Z"
        fill={color}
      />
      <path
        d="M393.326 236.138C393.993 235.754 394.826 236.235 394.826 237.005V366.316C394.826 369.889 392.92 373.19 389.826 374.976L277.846 439.628C277.179 440.013 276.346 439.531 276.346 438.761L276.344 309.456C276.344 305.883 278.25 302.582 281.344 300.796L393.326 236.138Z"
        fill={color}
      />
      <path
        d="M251.343 135.117C254.437 133.331 258.249 133.331 261.343 135.117L373.321 199.768C373.988 200.153 373.988 201.116 373.321 201.501L261.343 266.156C258.249 267.942 254.437 267.942 251.343 266.156L139.356 201.505C138.69 201.12 138.69 200.157 139.356 199.772L251.343 135.117Z"
        fill={color}
      />
    </svg>
  );
}

function MetaBadge({ label, solid = false }: { label: string; solid?: boolean }) {
  return (
    <div
      style={{
        alignItems: "center",
        background: solid ? theme.foreground : "rgba(255, 255, 255, 0.03)",
        border: `1px solid ${solid ? theme.foreground : theme.borderStrong}`,
        boxSizing: "border-box",
        color: solid ? theme.background : theme.mutedSoft,
        display: "flex",
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        flexShrink: 0,
        letterSpacing: "0.08em",
        padding: "7px 10px",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}

function FeaturePill({
  label,
  color,
  border,
  background,
}: {
  label: string;
  color: string;
  border: string;
  background: string;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        background,
        border: `1px solid ${border}`,
        boxSizing: "border-box",
        color,
        display: "flex",
        fontFamily: "ui-monospace, monospace",
        fontSize: 14,
        letterSpacing: "0.06em",
        padding: "7px 12px",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}

function ProviderCard({
  label,
  name,
  description,
  color,
  border,
  background,
}: {
  label: string;
  name: string;
  description: string;
  color: string;
  border: string;
  background: string;
}) {
  return (
    <div
      style={{
        background,
        border: `1px solid ${border}`,
        boxSizing: "border-box",
        display: "flex",
        flex: 1,
        flexDirection: "column",
        gap: 10,
        minHeight: 96,
        padding: 14,
      }}
    >
      <div
        style={{
          color,
          display: "flex",
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: theme.foreground,
          display: "flex",
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "-0.04em",
        }}
      >
        {name}
      </div>
      <div
        style={{
          color: theme.muted,
          display: "flex",
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        {description}
      </div>
    </div>
  );
}

export default function OpengraphImage() {
  const siteHost = URLs.site.replace(/^https?:\/\//, "");

  return new ImageResponse(
    <div
      style={{
        background: theme.background,
        boxSizing: "border-box",
        color: theme.foreground,
        display: "flex",
        height: "100%",
        overflow: "hidden",
        padding: "42px 46px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 0.5px, transparent 0.5px)",
          backgroundSize: "22px 22px",
          display: "flex",
          inset: 0,
          opacity: 0.04,
          position: "absolute",
        }}
      />
      <div
        style={{
          background:
            "radial-gradient(circle at 82% 18%, rgba(96,165,250,0.18) 0%, rgba(96,165,250,0) 28%)",
          display: "flex",
          inset: 0,
          position: "absolute",
        }}
      />
      <div
        style={{
          background:
            "radial-gradient(circle at 10% 86%, rgba(250,250,250,0.08) 0%, rgba(250,250,250,0) 24%)",
          display: "flex",
          inset: 0,
          position: "absolute",
        }}
      />
      <div
        style={{
          bottom: -8,
          display: "flex",
          position: "absolute",
          right: -26,
        }}
      >
        <BrandMark width={300} height={225} color={theme.foreground} opacity={0.04} />
      </div>

      <div
        style={{
          border: `1px solid ${theme.border}`,
          boxSizing: "border-box",
          display: "flex",
          gap: 34,
          height: "100%",
          padding: 0,
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "42px 38px 36px 38px",
            position: "relative",
            width: 640,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 10,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: `1px solid ${theme.borderStrong}`,
                  display: "flex",
                  gap: 10,
                  padding: "7px 12px",
                }}
              >
                <BrandMark width={18} height={14} color={theme.foreground} />
                <span
                  style={{
                    color: theme.foreground,
                    display: "flex",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 13,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {SITE_NAME}
                </span>
              </div>
              <MetaBadge label="Open Source" />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 74,
                  fontWeight: 700,
                  letterSpacing: "-0.07em",
                  lineHeight: 1,
                }}
              >
                Own your
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 74,
                  fontWeight: 700,
                  letterSpacing: "-0.07em",
                  lineHeight: 1,
                }}
              >
                payments.
              </div>
              <div
                style={{
                  color: theme.mutedSoft,
                  display: "flex",
                  fontSize: 42,
                  fontWeight: 500,
                  letterSpacing: "-0.05em",
                  lineHeight: 1.08,
                  marginTop: 8,
                }}
              >
                One API for&nbsp;
                <span
                  style={{
                    borderBottom: `1px dashed ${theme.borderStrong}`,
                    color: theme.foreground,
                    display: "flex",
                    paddingBottom: 4,
                  }}
                >
                  TypeScript SaaS.
                </span>
              </div>
            </div>

            <div
              style={{
                color: theme.muted,
                display: "flex",
                fontSize: 23,
                lineHeight: 1.45,
                maxWidth: 540,
              }}
            >
              Stripe, PayPal, and regional PSPs behind one interface. Verified webhooks,
              provider-native subscriptions, and your database as the source of truth.
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                maxWidth: 560,
              }}
            >
              {featurePills.map((pill) => (
                <FeaturePill
                  key={pill.label}
                  label={pill.label}
                  color={pill.color}
                  border={pill.border}
                  background={pill.background}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            padding: "28px 30px 28px 0",
            width: 434,
          }}
        >
          <div
            style={{
              background: `linear-gradient(180deg, ${theme.card} 0%, ${theme.cardSoft} 100%)`,
              border: `1px solid ${theme.borderStrong}`,
              display: "flex",
              flex: 1,
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                alignItems: "center",
                borderBottom: `1px solid ${theme.borderSoft}`,
                color: theme.muted,
                display: "flex",
                justifyContent: "space-between",
                padding: "14px 18px",
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    background: "rgba(248, 113, 113, 0.8)",
                    borderRadius: 999,
                    display: "flex",
                    height: 8,
                    width: 8,
                  }}
                />
                <div
                  style={{
                    background: "rgba(250, 204, 21, 0.8)",
                    borderRadius: 999,
                    display: "flex",
                    height: 8,
                    width: 8,
                  }}
                />
                <div
                  style={{
                    background: "rgba(74, 222, 128, 0.8)",
                    borderRadius: 999,
                    display: "flex",
                    height: 8,
                    width: 8,
                  }}
                />
                <span
                  style={{
                    color: theme.foreground,
                    display: "flex",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 13,
                    letterSpacing: "0.08em",
                    marginLeft: 4,
                    textTransform: "uppercase",
                  }}
                >
                  Orchestration Map
                </span>
              </div>

              <div
                style={{
                  color: theme.muted,
                  display: "flex",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 12,
                }}
              >
                paykit.sh
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                gap: 14,
                padding: 18,
              }}
            >
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: `1px solid ${theme.borderSoft}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    color: theme.muted,
                    display: "flex",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Input
                </div>
                <div
                  style={{
                    color: theme.foreground,
                    display: "flex",
                    fontSize: 34,
                    fontWeight: 600,
                    letterSpacing: "-0.05em",
                  }}
                >
                  Your app
                </div>
                <div
                  style={{
                    color: theme.muted,
                    display: "flex",
                    fontSize: 15,
                    lineHeight: 1.45,
                  }}
                >
                  Next.js, Node, queues, or workers send one shape into the orchestration layer.
                </div>
              </div>

              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    background: theme.borderSoft,
                    display: "flex",
                    flex: 1,
                    height: 1,
                  }}
                />
                <div
                  style={{
                    color: theme.muted,
                    display: "flex",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  normalize + route
                </div>
                <div
                  style={{
                    background: theme.borderSoft,
                    display: "flex",
                    flex: 1,
                    height: 1,
                  }}
                />
              </div>

              <div
                style={{
                  background: `linear-gradient(180deg, ${theme.backgroundSoft} 0%, ${theme.card} 100%)`,
                  border: `1px solid ${theme.borderStrong}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    color: theme.blue,
                    display: "flex",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Core
                </div>
                <div
                  style={{
                    color: theme.foreground,
                    display: "flex",
                    fontSize: 42,
                    fontWeight: 700,
                    letterSpacing: "-0.06em",
                    lineHeight: 1,
                  }}
                >
                  PayKit
                </div>
                <div
                  style={{
                    color: theme.muted,
                    display: "flex",
                    fontSize: 16,
                    lineHeight: 1.45,
                  }}
                >
                  Typed checkouts, subscriptions, and webhooks behind one extensible interface.
                </div>
              </div>

              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    background: theme.borderSoft,
                    display: "flex",
                    flex: 1,
                    height: 1,
                  }}
                />
                <div
                  style={{
                    color: theme.muted,
                    display: "flex",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  providers
                </div>
                <div
                  style={{
                    background: theme.borderSoft,
                    display: "flex",
                    flex: 1,
                    height: 1,
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                }}
              >
                {providerCards.map((provider) => (
                  <ProviderCard
                    key={provider.name}
                    label={provider.label}
                    name={provider.name}
                    description={provider.description}
                    color={provider.color}
                    border={provider.border}
                    background={provider.background}
                  />
                ))}
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: `1px solid ${theme.borderSoft}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    color: theme.muted,
                    display: "flex",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Source of truth
                </div>
                <div
                  style={{
                    color: theme.foreground,
                    display: "flex",
                    fontSize: 28,
                    fontWeight: 600,
                    letterSpacing: "-0.04em",
                  }}
                >
                  Your database owns the state
                </div>
                <div
                  style={{
                    color: theme.muted,
                    display: "flex",
                    fontSize: 14,
                    lineHeight: 1.45,
                  }}
                >
                  Invoices, subscriptions, usage, and normalized events stay in your schema.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
