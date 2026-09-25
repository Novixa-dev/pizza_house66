import { ImageResponse } from "next/og";

// The social preview card (docs/PRD.md §51).
//
// Generated rather than shipped as a static file so it stays consistent with
// the brand tokens, and drawn with primitives only — ImageResponse has no
// access to the app's stylesheet or to a web font that isn't explicitly
// fetched, and a link preview is not worth a font download on every build.

export const alt = "Pizza House — اطلب مسبقًا واستلم في وقتك";
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
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #a8261c 0%, #7d1a13 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: 80,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 132,
            height: 132,
            borderRadius: 66,
            background: "#f4c95d",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 36,
          }}
        >
          {/* A slice, drawn as a triangle — no external asset to resolve. */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "38px solid transparent",
              borderRight: "38px solid transparent",
              borderBottom: "68px solid #a8261c",
            }}
          />
        </div>

        <div style={{ display: "flex", fontSize: 72, fontWeight: 800, letterSpacing: -2 }}>
          Pizza House
        </div>
        <div style={{ display: "flex", fontSize: 34, marginTop: 18, opacity: 0.92 }}>
          Order ahead · Pick up on your schedule
        </div>
        <div style={{ display: "flex", fontSize: 26, marginTop: 40, opacity: 0.75 }}>
          Al Mukalla, Hadhramaut
        </div>
      </div>
    ),
    size
  );
}
