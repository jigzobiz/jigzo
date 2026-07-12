import React, { useRef, useEffect } from 'react';

function Badge({ kind }) {
  const svg = { display: "block", width: "100%", height: "100%", overflow: "visible" };
  const glyphInk = (
    <g fill="#050505">
      <rect x="33" y="33" width="34" height="34" rx="8" />
      <circle cx="50" cy="29" r="8.6" />
      <circle cx="50" cy="71" r="8.6" />
      <circle cx="29" cy="50" r="8.6" />
      <circle cx="71" cy="50" r="8.6" />
    </g>
  );
  const glyphCream = (
    <g fill="#FAF8EC">
      <rect x="33" y="33" width="34" height="34" rx="8" />
      <circle cx="50" cy="29" r="8.6" />
      <circle cx="50" cy="71" r="8.6" />
      <circle cx="29" cy="50" r="8.6" />
      <circle cx="71" cy="50" r="8.6" />
    </g>
  );

  if (kind === "gold") {
    return (
      <svg viewBox="0 0 100 100" style={svg}>
        <defs>
          <linearGradient id="rbGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E7C485" />
            <stop offset="0.45" stopColor="#A67C3D" />
            <stop offset="1" stopColor="#1C140A" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="49" fill="url(#rbGold)" />
        {glyphInk}
      </svg>
    );
  }
  if (kind === "cream") {
    return (
      <svg viewBox="0 0 100 100" style={svg}>
        <circle cx="50" cy="50" r="49" fill="#FAF8EC" />
        <circle cx="50" cy="50" r="48.3" fill="none" stroke="rgba(5,5,5,0.07)" strokeWidth="1" />
        {glyphInk}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" style={svg}>
      <circle cx="50" cy="50" r="49" fill="#111110" />
      <circle cx="50" cy="50" r="48.3" fill="none" stroke="rgba(166,124,61,0.42)" strokeWidth="1" />
      {glyphCream}
    </svg>
  );
}

export default function RevealBeat({ w, h, pad, radius }) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !root.animate) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { root.style.opacity = 0; return; }

    const orbit = root.querySelector("[data-b=orbit]");
    const glow = root.querySelector("[data-b=glow]");
    const radii = Array.from(root.querySelectorAll("[data-b=radius]"));
    const badges = Array.from(root.querySelectorAll("[data-b=badge]"));

    const dur = 3000, R = radius || 80, anims = [];

    anims.push(orbit.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(430deg)" }], {
      duration: dur,
      easing: "cubic-bezier(.45,.05,.2,1)",
      fill: "both"
    }));

    radii.forEach((el) => anims.push(el.animate([
      { transform: "translateX(0px)" },
      { transform: "translateX(" + R + "px)", offset: 0.34 },
      { transform: "translateX(" + R + "px)", offset: 0.72 },
      { transform: "translateX(0px)" }
    ], { duration: dur, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" })));

    badges.forEach((el, i) => {
      const s = (i === 1 ? 1 : -1) * 360;
      anims.push(el.animate([
        { transform: "rotate(0deg) scale(.85)" },
        { transform: "rotate(" + (s * 0.5) + "deg) scale(1.12)", offset: 0.5 },
        { transform: "rotate(" + s + "deg) scale(1)" }
      ], { duration: dur, easing: "ease-in-out", fill: "both" }));
    });

    if (glow) {
      anims.push(glow.animate([
        { opacity: 0, transform: "translate(-50%,-50%) scale(.5)" },
        { opacity: 0, transform: "translate(-50%,-50%) scale(.5)", offset: 0.55 },
        { opacity: 0.95, transform: "translate(-50%,-50%) scale(1)", offset: 0.82 },
        { opacity: 0, transform: "translate(-50%,-50%) scale(1.3)" }
      ], { duration: dur, easing: "ease-out", fill: "both" }));
    }

    anims.push(root.animate([{ opacity: 1, offset: 0.78 }, { opacity: 0 }], { duration: dur, fill: "forwards" }));

    return () => anims.forEach((a) => { try { a.cancel(); } catch (e) {} });
  }, [radius]);

  const badgeSize = 40;

  // Render overlay with relative dimensions (or standard fallback dimensions)
  const widthVal = w || '100%';
  const heightVal = h || '100%';
  const paddingVal = pad !== undefined ? pad : 0;

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: paddingVal,
        top: paddingVal,
        width: widthVal,
        height: heightVal,
        borderRadius: 14,
        overflow: "hidden",
        zIndex: 60,
        pointerEvents: "none",
        background: "radial-gradient(70% 70% at 50% 45%, #100e0b 0%, #050505 78%)"
      }}
    >
      <div
        data-b="glow"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 330,
          height: 330,
          transform: "translate(-50%,-50%) scale(.5)",
          opacity: 0,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(214,170,94,0.55) 0%, rgba(214,170,94,0.12) 42%, rgba(214,170,94,0) 70%)"
        }}
      />
      <div data-b="orbit" style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
        {[-90, 30, 150].map((ang, i) => (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, transform: `rotate(${ang}deg)` }}>
            <div data-b="radius" style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}>
              <div
                data-b="badge"
                style={{
                  position: "absolute",
                  left: -badgeSize / 2,
                  top: -badgeSize / 2,
                  width: badgeSize,
                  height: badgeSize,
                  filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.5))"
                }}
              >
                <Badge kind={i === 0 ? "gold" : i === 1 ? "cream" : "dark"} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
