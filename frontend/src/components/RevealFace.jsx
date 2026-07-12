import React from 'react';

const T = {
  mono: "'JetBrains Mono', ui-monospace, monospace",
  serif: "'Playfair Display', Georgia, serif",
  goldWarm: "#D6B074",
};

export default function RevealFace({ photo, toName, fromName, message }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden",
      background: photo ? `#050505 center/cover no-repeat url(${photo})` : "#100e0b" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 100% at 50% 42%, rgba(23,19,13,0.34), rgba(5,5,5,0.76) 78%)" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", textAlign: "center", padding: "9% 11%" }}>
        {toName ? (
          <div style={{ fontFamily: T.mono, fontWeight: 500, fontSize: 12.5, letterSpacing: "0.1em", color: T.goldWarm, marginBottom: 18, textShadow: "0 1px 4px rgba(5,5,5,0.8)" }}>{toName}</div>
        ) : null}
        <div style={{ fontFamily: T.serif, fontStyle: "italic", fontWeight: 400, fontSize: 20, lineHeight: 1.32,
          color: "#F3ECDD", whiteSpace: "pre-line", maxWidth: "22ch", textShadow: "0 1px 3px rgba(5,5,5,0.92), 0 2px 22px rgba(5,5,5,0.6)" }}>
          {message || "Your message will appear here."}
        </div>
        <div style={{ width: 44, height: 2, marginTop: 18, background: "linear-gradient(90deg, rgba(208,160,54,0), #D0A036, rgba(208,160,54,0))" }} />
        {fromName ? (
          <div style={{ fontFamily: T.mono, fontWeight: 500, fontSize: 12, letterSpacing: "0.08em", color: "rgba(238,232,220,0.82)", marginTop: 14, textShadow: "0 1px 4px rgba(5,5,5,0.8)" }}>{fromName}</div>
        ) : null}
      </div>
    </div>
  );
}
