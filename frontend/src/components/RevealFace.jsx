import React from 'react';
import { useTranslation } from 'react-i18next';

export default function RevealFace({ photo, toName, fromName, message }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const T = {
    mono: isAr ? "'Noto Sans Arabic', sans-serif" : "'JetBrains Mono', ui-monospace, monospace",
    serif: isAr ? "'Noto Naskh Arabic', serif" : "'Playfair Display', Georgia, serif",
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#050505",
        containerType: "inline-size",
        direction: isAr ? "rtl" : "ltr"
      }}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 100% at 50% 42%, rgba(23,19,13,0.34), rgba(5,5,5,0.76) 78%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "9% 11%",
        }}
      >
        {toName ? (
          <div
            style={{
              fontFamily: T.mono,
              fontWeight: 500,
              fontSize: "4.34cqw",
              letterSpacing: isAr ? "normal" : "0.1em",
              color: "#E6C67F",
              marginBottom: "6.25cqw",
              textShadow: "0 1px 4px rgba(5,5,5,0.8)",
            }}
          >
            {toName}
          </div>
        ) : null}

        <div
          style={{
            fontFamily: T.serif,
            fontStyle: isAr ? "normal" : "italic",
            fontWeight: 400,
            fontSize: "6.94cqw",
            lineHeight: 1.32,
            color: "#F3ECDD",
            whiteSpace: "pre-line",
            maxWidth: "22ch",
            textShadow:
              "0 1px 3px rgba(5,5,5,0.92), 0 2px 22px rgba(5,5,5,0.6)",
          }}
        >
          {message || "Your message will appear here."}
        </div>

        <div
          style={{
            width: "15.28cqw",
            height: "max(1px, 0.69cqw)",
            marginTop: "6.25cqw",
            background:
              "linear-gradient(90deg, rgba(208,160,54,0), #D0A036, rgba(208,160,54,0))",
          }}
        />

        {fromName ? (
          <div
            style={{
              fontFamily: T.mono,
              fontWeight: 500,
              fontSize: "4.17cqw",
              letterSpacing: isAr ? "normal" : "0.08em",
              color: "rgba(238,232,220,0.82)",
              marginTop: "4.86cqw",
              textShadow: "0 1px 4px rgba(5,5,5,0.8)",
            }}
          >
            {fromName}
          </div>
        ) : null}
      </div>
    </div>
  );
}
