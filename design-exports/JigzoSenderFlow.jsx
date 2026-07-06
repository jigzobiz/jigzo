import React, { useState, useRef, useCallback, useMemo } from "react";

/* ---------------------------------------------------------
   JIGZO — Tier 1 Sender Flow Prototype
   Brand tokens (locked):
   cream  #FAF8EC
   ink    #050505
   gold gradient  #D6AA5E -> #A67C3D -> #1C140A  (reveal moments only)
   Typeface: Archia — the brand face, self-hosted from assets/fonts/.
--------------------------------------------------------- */

const OCCASIONS = [
  { id: "love", label: "Love", copy: "Someone wants to say something close to the heart." },
  { id: "birthday", label: "Birthday", copy: "A birthday surprise is waiting to be unlocked." },
  { id: "congrats", label: "Congratulations", copy: "Big news deserves a moment worth solving for." },
  { id: "newborn", label: "Newborn", copy: "A tiny new person, a message to welcome them." },
  { id: "sorry", label: "Sorry", copy: "Some words are easier to give than to say." },
  { id: "getwell", label: "Get well soon", copy: "A little puzzle, a lot of hope." },
  { id: "justbecause", label: "Just because", copy: "No occasion needed — just a reason to smile." },
];

const PRESET_MESSAGES = {
  love: "Every piece of this took me back to you. I love you, more than this puzzle can hold.",
  birthday: "Another year of you — and I couldn't be happier it's here. Happy birthday!",
  congrats: "You did it. I'm so proud of you, I had to put it back together to say it.",
  newborn: "Welcome to the world, little one. You're already so loved.",
  sorry: "I'm sorry. I should've said this sooner, but I needed you to really see it.",
  getwell: "Sending you strength, one piece at a time. Get well soon — we miss you.",
  justbecause: "No reason, just wanted you to know I was thinking of you today.",
};

// Non-square grids (portrait 9:16 board) so pieces stay roughly square, not stretched.
const PIECE_OPTIONS = [
  { count: 15, cols: 3, rows: 5, label: "15 pieces", sub: "Easy" },
  { count: 18, cols: 3, rows: 6, label: "18 pieces", sub: "Medium" },
  { count: 28, cols: 4, rows: 7, label: "28 pieces", sub: "Hard" },
];

const STEPS = ["upload", "crop", "pieces", "names", "occasion", "preview"];
const STEP_LABELS = {
  upload: "Photo",
  crop: "Frame it",
  pieces: "Difficulty",
  names: "From & To",
  occasion: "Occasion & message",
  preview: "Preview",
};

/* Piece geometry (mulberry32 / buildEdgeMap / edgeWithTab / piecePath) is NOT
   defined here anymore. It lives in the shared puzzle-shape.js, which create.html
   loads as a global <script> so the sender preview and the live receiver board
   render the exact same jigsaw shapes (single source of truth). When
   regenerating create.html from this file, keep the <script src="puzzle-shape.js">
   include and do NOT re-inline these functions, or the two will drift again. */

function StepRail({ step }) {
  const idx = STEPS.indexOf(step);
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 28, flexWrap: "wrap" }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: i <= idx ? "#A67C3D" : "rgba(5,5,5,0.15)",
              transition: "background 0.3s",
            }}
          />
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: i === idx ? "#050505" : "rgba(5,5,5,0.35)",
              fontWeight: i === idx ? 600 : 400,
            }}
          >
            {STEP_LABELS[s]}
          </span>
          {i < STEPS.length - 1 && (
            <div style={{ width: 16, height: 1, background: "rgba(5,5,5,0.12)", marginLeft: 4 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "rgba(5,5,5,0.15)" : "#050505",
        color: disabled ? "rgba(5,5,5,0.4)" : "#FAF8EC",
        border: "none",
        borderRadius: 999,
        padding: "13px 28px",
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: "0.01em",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "transform 0.15s ease, opacity 0.15s ease",
        fontFamily: "Archia, sans-serif",
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "transparent",
        color: disabled ? "rgba(5,5,5,0.25)" : "#050505",
        border: "1px solid rgba(5,5,5,0.18)",
        borderRadius: 999,
        padding: "13px 24px",
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "Archia, sans-serif",
      }}
    >
      {children}
    </button>
  );
}

export default function JigzoSenderFlow() {
  const [step, setStep] = useState("upload");
  const [imgSrc, setImgSrc] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropData, setCropData] = useState(null); // final captured crop as dataURL
  const [pieceCount, setPieceCount] = useState(18);
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");
  const [revealIdentity, setRevealIdentity] = useState(true);
  const [occasion, setOccasion] = useState(null);
  const [message, setMessage] = useState("");
  const [revealStage, setRevealStage] = useState(false);

  const dragRef = useRef(null);
  const fileInputRef = useRef(null);
  const cropFrameRef = useRef(null);
  const imgElRef = useRef(null);

  const dims = useMemo(
    () => PIECE_OPTIONS.find((p) => p.count === pieceCount) || { cols: 3, rows: 6 },
    [pieceCount]
  );
  const cols = dims.cols, rows = dims.rows;
  const edgeMap = useMemo(() => buildEdgeMap(cols, rows, 1337), [cols, rows]);
  // portrait 9:16 board; non-square grid keeps pieces roughly square
  const BOARD_W = 360;
  const BOARD_H = 640;               // 9:16
  const pieceW = BOARD_W / cols;
  const pieceH = BOARD_H / rows;
  // viewBox margin big enough that scattered pieces (incl. the chunky tabs) are never clipped
  const MX = pieceH * 0.5;
  const MY = pieceW * 0.5;
  const viewBox = `${-MX} ${-MY} ${BOARD_W + 2 * MX} ${BOARD_H + 2 * MY}`;

  /* deterministic scrambled layout for the "locked" preview: every piece is
     dealt to a different cell than its home, with slight jitter + rotation, so
     it reads as a jumbled tray of pieces rather than the finished photo */
  const scramble = useMemo(() => {
    const rand = mulberry32(97 + (cols * 31 + rows) * 131);
    const slots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push({ r, c });
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = slots[i]; slots[i] = slots[j]; slots[j] = t;
    }
    const jx = pieceW * 0.14, jy = pieceH * 0.14;
    return slots.map((home, idx) => ({
      r: home.r,
      c: home.c,
      x: (idx % cols) * pieceW + (rand() - 0.5) * 2 * jx,
      y: Math.floor(idx / cols) * pieceH + (rand() - 0.5) * 2 * jy,
      rot: (rand() - 0.5) * 2 * 14,
    }));
  }, [cols, rows, pieceW, pieceH]);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImgSrc(e.target.result);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setStep("crop");
    };
    reader.readAsDataURL(file);
  };

  const onPointerDown = (e) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origPan: { ...pan },
    };
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.origPan.x + dx, y: dragRef.current.origPan.y + dy });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const captureCrop = useCallback(() => {
    const imgEl = imgElRef.current;
    const frame = cropFrameRef.current;
    if (!imgEl || !frame) return;
    const frameRect = frame.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();

    const canvas = document.createElement("canvas");
    const OUT_W = 540, OUT_H = 960;   // 9:16 portrait
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");

    const scaleX = imgEl.naturalWidth / imgRect.width;
    const scaleY = imgEl.naturalHeight / imgRect.height;
    const sx = (frameRect.left - imgRect.left) * scaleX;
    const sy = (frameRect.top - imgRect.top) * scaleY;
    const sw = frameRect.width * scaleX;
    const sh = frameRect.height * scaleY;

    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
    setCropData(canvas.toDataURL("image/jpeg", 0.92));
    setStep("pieces");
  }, []);

  const occasionObj = OCCASIONS.find((o) => o.id === occasion);

  return (
    <div
      style={{
        fontFamily: "Archia, sans-serif",
        background: "#FAF8EC",
        minHeight: "100vh",
        color: "#050505",
        padding: "32px 20px 80px",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        ::placeholder { color: rgba(5,5,5,0.35); }
        textarea, input { font-family: 'Archia', sans-serif; }
        @keyframes pulseGlyph {
          0%, 100% { opacity: 0.35; transform: scale(0.96); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 36 }}>
          <img src="assets/JIGZO-Logo-Black.png" alt="JIGZO" style={{ height: 24, width: "auto", display: "block" }} />
          <span style={{ fontSize: 11, color: "rgba(5,5,5,0.45)" }}>· jigzo.biz sender preview</span>
        </div>

        <StepRail step={step} />

        {/* ---------------- UPLOAD ---------------- */}
        {step === "upload" && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
              Start with a photo
            </h1>
            <p style={{ fontSize: 14, color: "rgba(5,5,5,0.55)", margin: "0 0 24px", lineHeight: 1.5 }}>
              Pick the moment you want them to piece back together.
            </p>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              onDragOver={(e) => e.preventDefault()}
              style={{
                border: "1.5px dashed rgba(5,5,5,0.25)",
                borderRadius: 18,
                padding: "56px 20px",
                textAlign: "center",
                cursor: "pointer",
                background: "rgba(5,5,5,0.02)",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>🖼️</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Tap to upload a photo</div>
              <div style={{ fontSize: 12.5, color: "rgba(5,5,5,0.45)" }}>JPG or PNG, portrait works best</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {/* ---------------- CROP WITH MASK ---------------- */}
        {step === "crop" && imgSrc && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Frame the moment</h1>
            <p style={{ fontSize: 13.5, color: "rgba(5,5,5,0.55)", margin: "0 0 20px" }}>
              Drag to reposition, use the slider to zoom. This portrait frame is exactly what gets sent.
            </p>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <div
                ref={cropFrameRef}
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 300,
                  aspectRatio: "9 / 16",
                  borderRadius: 20,
                  overflow: "hidden",
                  background: "#000",
                  cursor: "grab",
                  touchAction: "none",
                  boxShadow: "0 0 0 2px #FAF8EC, 0 0 0 3px rgba(5,5,5,0.12)",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              >
                <img
                  ref={imgElRef}
                  src={imgSrc}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    minWidth: "100%",
                    minHeight: "100%",
                    transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                />
                {/* corner ticks — the whole frame is the crop area now */}
                {[
                  { top: 10, left: 10 }, { top: 10, right: 10 },
                  { bottom: 10, left: 10 }, { bottom: 10, right: 10 },
                ].map((pos, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      width: 16,
                      height: 16,
                      border: "2px solid #A67C3D",
                      pointerEvents: "none",
                      ...(pos.top !== undefined ? { top: pos.top, borderBottom: "none" } : { bottom: pos.bottom, borderTop: "none" }),
                      ...(pos.left !== undefined ? { left: pos.left, borderRight: "none" } : { right: pos.right, borderLeft: "none" }),
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 6px" }}>
              <span style={{ fontSize: 18 }}>−</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: "#A67C3D" }}
              />
              <span style={{ fontSize: 18 }}>+</span>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <GhostButton onClick={() => setStep("upload")}>Back</GhostButton>
              <PrimaryButton onClick={captureCrop} style={{ flex: 1 }}>
                Confirm frame
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ---------------- PIECE COUNT ---------------- */}
        {step === "pieces" && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Choose the difficulty</h1>
            <p style={{ fontSize: 13.5, color: "rgba(5,5,5,0.55)", margin: "0 0 20px" }}>
              More pieces, more time before the reveal.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {PIECE_OPTIONS.map((opt) => (
                <button
                  key={opt.count}
                  onClick={() => setPieceCount(opt.count)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 18px",
                    borderRadius: 14,
                    border: pieceCount === opt.count ? "1.5px solid #050505" : "1.5px solid rgba(5,5,5,0.12)",
                    background: pieceCount === opt.count ? "rgba(5,5,5,0.04)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: "rgba(5,5,5,0.45)" }}>{opt.sub}</div>
                  </div>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: "1.5px solid #050505",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {pieceCount === opt.count && (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#050505" }} />
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <GhostButton onClick={() => setStep("crop")}>Back</GhostButton>
              <PrimaryButton onClick={() => setStep("names")} style={{ flex: 1 }}>
                Continue
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ---------------- NAMES ---------------- */}
        {step === "names" && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Who's this for?</h1>
            <p style={{ fontSize: 13.5, color: "rgba(5,5,5,0.55)", margin: "0 0 20px" }}>
              These names appear once the puzzle is solved.
            </p>
            <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>From</label>
            <input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Your name"
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: 12,
                border: "1.5px solid rgba(5,5,5,0.15)",
                fontSize: 14.5,
                marginBottom: 14,
                background: "transparent",
                outline: "none",
              }}
            />
            <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>To</label>
            <input
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              placeholder="Recipient's name"
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: 12,
                border: "1.5px solid rgba(5,5,5,0.15)",
                fontSize: 14.5,
                marginBottom: 16,
                background: "transparent",
                outline: "none",
              }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={revealIdentity}
                onChange={(e) => setRevealIdentity(e.target.checked)}
                style={{ accentColor: "#A67C3D", width: 16, height: 16 }}
              />
              Show my name in the "waiting for you" message
            </label>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <GhostButton onClick={() => setStep("pieces")}>Back</GhostButton>
              <PrimaryButton onClick={() => setStep("occasion")} disabled={!fromName || !toName} style={{ flex: 1 }}>
                Continue
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ---------------- OCCASION + MESSAGE (one window) ---------------- */}
        {step === "occasion" && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Occasion & message</h1>
            <p style={{ fontSize: 13.5, color: "rgba(5,5,5,0.55)", margin: "0 0 18px" }}>
              Pick what this is for — we'll suggest a message, edit it however you like.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {OCCASIONS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setOccasion(o.id);
                    if (!message.trim() || OCCASIONS.some((x) => x.id !== o.id && PRESET_MESSAGES[x.id] === message)) {
                      setMessage(PRESET_MESSAGES[o.id]);
                    }
                  }}
                  style={{
                    padding: "13px 12px",
                    borderRadius: 14,
                    border: occasion === o.id ? "1.5px solid #050505" : "1.5px solid rgba(5,5,5,0.12)",
                    background: occasion === o.id ? "rgba(5,5,5,0.04)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {occasionObj && (
              <p style={{ fontSize: 12, color: "rgba(5,5,5,0.5)", margin: "0 0 16px", fontStyle: "italic" }}>
                {occasionObj.copy}
              </p>
            )}

            <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Message {occasion && <span style={{ fontWeight: 400, color: "rgba(5,5,5,0.45)" }}>· suggested, edit freely</span>}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 200))}
              placeholder={occasion ? PRESET_MESSAGES[occasion] : "Pick an occasion above to get a suggestion, or just start typing..."}
              rows={5}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 14,
                border: "1.5px solid rgba(5,5,5,0.15)",
                fontSize: 14.5,
                resize: "none",
                outline: "none",
                background: "transparent",
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {occasion ? (
                <button
                  onClick={() => setMessage(PRESET_MESSAGES[occasion])}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 11.5,
                    color: "#A67C3D",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Reset to suggested
                </button>
              ) : <span />}
              <div style={{ fontSize: 11.5, color: "rgba(5,5,5,0.4)" }}>{message.length}/200</div>
            </div>

            {/* live preview — mirrors the reveal card, updates in real time as you type */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(5,5,5,0.4)", marginBottom: 8 }}>
                Live preview
              </div>
              <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#050505", padding: "26px 22px", textAlign: "center" }}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at center, rgba(166,124,61,0.28), rgba(5,5,5,0.7) 72%)" }} />
                <div style={{ position: "relative", color: "#FAF8EC" }}>
                  <div style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.7, marginBottom: 9 }}>
                    {toName || "—"}
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.55, fontWeight: 500, marginBottom: 11, whiteSpace: "pre-line" }}>
                    "{message || "Your message will appear here as you type."}"
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>{fromName || "Someone"}</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <GhostButton onClick={() => setStep("names")}>Back</GhostButton>
              <PrimaryButton onClick={() => setStep("preview")} disabled={!occasion || !message.trim()} style={{ flex: 1 }}>
                Preview
              </PrimaryButton>
            </div>
          </div>
        )}


        {/* ---------------- PREVIEW ---------------- */}
        {step === "preview" && cropData && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Exactly what they'll see</h1>
            <p style={{ fontSize: 13.5, color: "rgba(5,5,5,0.55)", margin: "0 0 20px" }}>
              Tap the puzzle to see how it solves and reveals.
            </p>

            <div
              style={{
                borderRadius: 18,
                overflow: "hidden",
                background: "#FAF8EC",
                position: "relative",
                width: "100%",
                maxWidth: 300,
                margin: "0 auto",
                aspectRatio: "9 / 16",
                cursor: "pointer",
              }}
              onClick={() => setRevealStage((s) => !s)}
            >
              {!revealStage ? (
                <svg viewBox={viewBox} style={{ width: "100%", height: "100%", display: "block" }}>
                  <defs>
                    <filter id="pieceShadow" x="-25%" y="-25%" width="150%" height="150%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.4" />
                    </filter>
                    {scramble.map((p, i) => (
                      <clipPath id={`lockPc-${i}`} key={i}>
                        <path d={piecePath(p.r, p.c, cols, rows, pieceW, pieceH, edgeMap)} />
                      </clipPath>
                    ))}
                  </defs>
                  {/* pieces scattered on the cream board (no clipping thanks to the viewBox margin) */}
                  {scramble.map((p, i) => (
                    <g
                      key={i}
                      transform={`translate(${p.x} ${p.y}) rotate(${p.rot} ${pieceW / 2} ${pieceH / 2})`}
                      filter="url(#pieceShadow)"
                    >
                      {/* clip the full photo down to this one piece's shape */}
                      <g clipPath={`url(#lockPc-${i})`}>
                        <image
                          href={cropData}
                          x={-p.c * pieceW}
                          y={-p.r * pieceH}
                          width={BOARD_W}
                          height={BOARD_H}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </g>
                      <path
                        d={piecePath(p.r, p.c, cols, rows, pieceW, pieceH, edgeMap)}
                        fill="none"
                        stroke="#050505"
                        strokeOpacity="0.35"
                        strokeWidth="1.1"
                      />
                    </g>
                  ))}
                </svg>
              ) : (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    animation: "fadeUp 0.5s ease",
                  }}
                >
                  <img
                    src={cropData}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      filter: "brightness(0.55) saturate(0.9)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "radial-gradient(circle at center, rgba(166,124,61,0.35), rgba(5,5,5,0.65) 70%)",
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
                      padding: 28,
                      textAlign: "center",
                      color: "#FAF8EC",
                    }}
                  >
                    <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.7, marginBottom: 12 }}>
                      {toName || "—"}
                    </div>
                    <div style={{ fontSize: 16.5, lineHeight: 1.55, fontWeight: 400, marginBottom: 14, whiteSpace: "pre-line" }}>
                      "{message || "Your message will appear here."}"
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.9 }}>
                      {fromName || "Someone"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <p style={{ fontSize: 11.5, color: "rgba(5,5,5,0.45)", textAlign: "center", marginTop: 8 }}>
              {revealStage ? "Tap to see the scrambled puzzle again" : "Tap to see how it solves and reveals"}
            </p>

            <div
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 14,
                background: "rgba(5,5,5,0.035)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <div><strong>From</strong> · {fromName || "—"}{revealIdentity ? "" : " (hidden in the teaser, always shown at reveal)"}</div>
              <div><strong>To</strong> · {toName || "—"}</div>
              <div><strong>Occasion</strong> · {occasionObj?.label || "—"}</div>
              <div><strong>Difficulty</strong> · {pieceCount} pieces</div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: "rgba(5,5,5,0.5)" }}>
                Expires 7 days after solving, or 30 days from today if never opened.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <GhostButton onClick={() => setStep("occasion")}>Edit occasion/message</GhostButton>
              <PrimaryButton
                style={{ flex: 1 }}
                onClick={() => {
                  const payload = {
                    cropData,
                    message,
                    fromName,
                    toName,
                    occasion,
                    occasionLabel: occasionObj?.label || "",
                    pieceCount,
                    revealIdentity,
                  };
                  try {
                    localStorage.setItem("jigzo:test-puzzle", JSON.stringify(payload));
                  } catch (e) {
                    alert("Couldn't save the puzzle for the local test (storage full?).");
                    return;
                  }
                  window.open("receive.html", "_blank");
                }}
              >
                Send puzzle
              </PrimaryButton>
            </div>
            <p style={{ fontSize: 11.5, color: "rgba(5,5,5,0.5)", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
              🔗 Local test — “Send puzzle” opens the receiver experience
              (locked → solve → reveal) in a new tab. No real send or database yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
