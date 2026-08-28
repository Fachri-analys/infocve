import { ImageResponse } from "next/og";

import { SITE_DESCRIPTION, SITE_NAME } from "@/utils/constants";

export const runtime = "edge";
export const alt = `${SITE_NAME} — Basis Pengetahuan Kerentanan Siber`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0e1a",
          backgroundImage: "radial-gradient(ellipse 80% 60% at 30% 0%, rgba(124,155,255,0.35), transparent)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "rgba(124,155,255,0.15)",
              border: "1px solid rgba(124,155,255,0.35)",
              color: "#7c9bff",
              fontSize: 32,
            }}
          >
            🛡
          </div>
          <span style={{ fontSize: 40, fontWeight: 600, color: "#e8ecf7" }}>{SITE_NAME}</span>
        </div>
        <div style={{ display: "flex", marginTop: 40, fontSize: 30, color: "#e8ecf7", maxWidth: 900, lineHeight: 1.35 }}>
          Basis pengetahuan kerentanan siber untuk Indonesia
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 22, color: "#8b95ac", maxWidth: 820, lineHeight: 1.5 }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    { ...size }
  );
}
