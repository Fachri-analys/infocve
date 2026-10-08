import { ImageResponse } from "next/og";
import { getCVEById } from "@/lib/nvd";
import { SITE_NAME } from "@/utils/constants";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "rgba(220, 38, 38, 0.2)", text: "#ef4444", border: "rgba(220, 38, 38, 0.5)" },
  HIGH: { bg: "rgba(234, 88, 12, 0.2)", text: "#f97316", border: "rgba(234, 88, 12, 0.5)" },
  MEDIUM: { bg: "rgba(217, 119, 6, 0.2)", text: "#f59e0b", border: "rgba(217, 119, 6, 0.5)" },
  LOW: { bg: "rgba(22, 163, 74, 0.2)", text: "#22c55e", border: "rgba(22, 163, 74, 0.5)" },
  NONE: { bg: "rgba(156, 163, 175, 0.2)", text: "#9ca3af", border: "rgba(156, 163, 175, 0.5)" },
};

interface OpengraphImageProps {
  params: Promise<{ id: string }>;
}

export default async function OpengraphImage({ params }: OpengraphImageProps) {
  const { id } = await params;
  const cve = await getCVEById(id).catch(() => null);

  const severity = cve?.cvss?.severity ?? "UNKNOWN";
  const score = cve?.cvss?.baseScore ? cve.cvss.baseScore.toFixed(1) : "-";
  const title = cve?.title || "Informasi Kerentanan Keamanan Siber";
  const vendor = cve?.vendor || "";
  const product = cve?.product || "";

  const sevColor = SEVERITY_COLORS[severity] || {
    bg: "rgba(107, 114, 128, 0.2)",
    text: "#9ca3af",
    border: "rgba(107, 114, 128, 0.5)",
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          background: "#0a0e1a",
          backgroundImage: "radial-gradient(ellipse 80% 60% at 30% 0%, rgba(124,155,255,0.25), transparent)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(124,155,255,0.15)",
                border: "1px solid rgba(124,155,255,0.35)",
                color: "#7c9bff",
                fontSize: 24,
              }}
            >
              🛡
            </div>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#e8ecf7" }}>{SITE_NAME}</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 20px",
              borderRadius: 9999,
              background: sevColor.bg,
              border: `1px solid ${sevColor.border}`,
              color: sevColor.text,
              fontSize: 20,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {severity} • CVSS {score}
          </div>
        </div>

        {/* Main Body */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 54,
              fontWeight: 800,
              color: "#ffffff",
              fontFamily: "monospace",
              letterSpacing: "-1px",
            }}
          >
            {id}
          </div>

          <div
            style={{
              fontSize: 24,
              color: "#cbd5e1",
              maxWidth: 960,
              lineHeight: 1.4,
              display: "-webkit-box",
              overflow: "hidden",
            }}
          >
            {title}
          </div>
        </div>

        {/* Footer Meta */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            paddingTop: 24,
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {vendor && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 18 }}>
                <span style={{ color: "#64748b" }}>Vendor:</span>
                <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{vendor}</span>
              </div>
            )}
            {product && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 18 }}>
                <span style={{ color: "#64748b" }}>Produk:</span>
                <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{product}</span>
              </div>
            )}
          </div>

          <div style={{ fontSize: 16, color: "#64748b" }}>
            Basis Pengetahuan Kerentanan Siber Indonesia
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
