import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { packageForRecipientCount } from '../services/pricing';
import { COUNTRIES } from '../config/countries';
import { PACK_OPTIONS, UPGRADES } from '../config/packages';
import { PIECE_OPTIONS, OCCASIONS, TONES, suggestedMessage } from '../config/difficulties';
import WhatsAppPreview from '../components/WhatsAppPreview';
import RevealFace from '../components/RevealFace';
import LoaderOrbit from '../components/LoaderOrbit';

const T = {
  bg: "#FAF8EC",
  card: "#FFFFFF",
  ink: "#1C1913",
  ink74: "rgba(28,25,19,0.74)",
  ink66: "rgba(28,25,19,0.66)",
  ink60: "rgba(28,25,19,0.60)",
  ink50: "rgba(28,25,19,0.50)",
  ink40: "rgba(28,25,19,0.40)",
  ink15: "rgba(28,25,19,0.15)",
  ink08: "rgba(28,25,19,0.08)",
  gold: "#CBBBA4",
  goldDeep: "#A67C3D",
  goldBright: "#E6C67F",
  goldWarm: "#D6B074",
  goldBrightHex: "#E6C67F",
  shadowRest: "0 2px 8px rgba(28,25,19,0.04)",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  serif: "'Playfair Display', Georgia, serif",
};

const inputStyle = {
  width: "100%", padding: "13px 14px", borderRadius: 12, border: "1.5px solid " + T.ink15,
  fontSize: "16px", background: T.card, outline: "none", color: T.ink,
};

function PrimaryButton({ children, onClick, disabled, style }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ background: disabled ? T.ink40 : T.ink, color: T.bg, border: "none",
        borderRadius: 999, padding: "14px 24px", fontSize: 15, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "Archia, sans-serif", ...style }}>
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ background: "transparent", color: disabled ? T.ink40 : T.ink, border: "1px solid " + T.ink15,
        borderRadius: 999, padding: "14px 24px", fontSize: 15, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "Archia, sans-serif" }}>
      {children}
    </button>
  );
}

function Disclosure({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="disclosure-btn" aria-expanded={isOpen}>
        <span>{title}</span>
        <span style={{ fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

function PuzzleBadge({ size }) {
  return (
    <svg viewBox="0 0 100 100" style={{ display: "block", width: size, height: size, overflow: "visible" }}>
      <defs>
        <linearGradient id="pBadgeG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E7C485" />
          <stop offset="0.45" stopColor="#A67C3D" />
          <stop offset="1" stopColor="#1C140A" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="49" fill="url(#pBadgeG)" />
      <g fill="#050505">
        <rect x="33" y="33" width="34" height="34" rx="8" />
        <circle cx="50" cy="29" r="8.6" />
        <circle cx="50" cy="71" r="8.6" />
        <circle cx="29" cy="50" r="8.6" />
        <circle cx="71" cy="50" r="8.6" />
      </g>
    </svg>
  );
}

function StepProgressBar({ step }) {
  const labels = ["Create", "Personalize", "Send", "Review & Pay"];
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="progress-bar">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`progress-bar__seg ${i <= step ? "progress-bar__seg--active" : ""}`} />
        ))}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, letterSpacing: "0.02em" }} aria-current="step">
        Step {step} of 4 — {labels[step - 1]}
      </div>
    </div>
  );
}

function phoneDigits(v) { return (v || "").replace(/\D/g, ""); }
function phoneValid(v) { const d = phoneDigits(v); return d.length >= 7 && d.length <= 12; }

export default function CreatePage() {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [imgSrc, setImgSrc] = useState(null);
  const [cropData, setCropData] = useState(null);
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [revealIdentity, setRevealIdentity] = useState(true);
  const [pieceCount, setPieceCount] = useState(18);
  const [selectedUpgrades, setSelectedUpgrades] = useState([]);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [testLink, setTestLink] = useState("");

  const [recipients, setRecipients] = useState([
    { name: "", phone: "", country: COUNTRIES[0] }
  ]);

  const [primaryRecipientName, setPrimaryRecipientName] = useState("");

  // Crop Zoom & Pan States
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const dragRef = useRef(null);

  const fileInputRef = useRef(null);
  const cropFrameRef = useRef(null);
  const imgElRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Force reset browser viewport zoom on step transition
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      const orig = meta.getAttribute("content");
      meta.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0");
      setTimeout(() => {
        meta.setAttribute("content", orig || "width=device-width, initial-scale=1.0");
      }, 150);
    }
  }, [currentStep, isProcessing, isSuccess]);

  // Sync recipient #1 name with primary recipient name
  const handlePrimaryRecipientNameChange = (val) => {
    setPrimaryRecipientName(val);
    setRecipients(prev => {
      const next = [...prev];
      if (next[0]) {
        next[0].name = val;
      } else {
        next[0] = { name: val, phone: "", country: COUNTRIES[0] };
      }
      return next;
    });
  };

  const currentPack = useMemo(() => {
    return packageForRecipientCount(recipients.length);
  }, [recipients.length]);

  const BASE_PRICE = currentPack.price;

  const [occasion, setOccasion] = useState("");
  const [tone, setTone] = useState("");
  const [packageAccordionOpen, setPackageAccordionOpen] = useState(false);
  const [difficultyOpen, setDifficultyOpen] = useState(false);

  const occasionObj = OCCASIONS.find((o) => o.id === occasion);
  const toneObj = TONES.find((t) => t.id === tone);

  const getUpgradePrice = (uId) => {
    if (uId === "insights") {
      return currentPack.insightsPrice;
    }
    return 1;
  };

  const toggleUpgrade = (id) => setSelectedUpgrades((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.concat(id));
  const upgradesTotal = selectedUpgrades.reduce((sum, id) => sum + getUpgradePrice(id), 0);
  const grandTotal = BASE_PRICE + upgradesTotal;

  // Country Dial Selectors
  const [senderCountry, setSenderCountry] = useState(COUNTRIES[0]);
  const senderValid = phoneValid(senderCountry.dial + senderPhone);

  const recipientNumbers = useMemo(() => {
    return recipients.map(r => r.country.dial + r.phone);
  }, [recipients]);

  const recipientsValid = useMemo(() => {
    const phoneSet = new Set();
    for (const r of recipients) {
      if (!r.name.trim()) return false;
      const fullPhone = r.country.dial + r.phone;
      if (!phoneValid(fullPhone)) return false;
      if (phoneSet.has(fullPhone)) return false;
      phoneSet.add(fullPhone);
    }
    return true;
  }, [recipients]);

  const step3Ready = senderName && senderValid && recipientsValid;

  const pickCombo = (occ, tn) => {
    const nextSug = suggestedMessage(occ, tn);
    const prevSug = suggestedMessage(occasion, tone);
    if (!message.trim() || message === prevSug) setMessage(nextSug);
  };

  const useSuggested = () => {
    const sug = suggestedMessage(occasion, tone);
    if (sug) setMessage(sug);
  };

  // Image Drag and Pan calculation methods
  const clampPan = useCallback((x, y, scaleVal) => {
    const frame = cropFrameRef.current;
    const imgEl = imgElRef.current;
    if (!frame || !imgEl || !imgEl.naturalWidth) return { x: 0, y: 0 };
    const rect = frame.getBoundingClientRect();
    const Wf = rect.width, Hf = rect.height;
    const Wi = imgEl.naturalWidth, Hi = imgEl.naturalHeight;
    const containScale = Math.min(Wf / Wi, Hf / Hi);
    const wEff = Wi * containScale * scaleVal;
    const hEff = Hi * containScale * scaleVal;
    const maxX = Math.max(0, (wEff - Wf) / 2);
    const maxY = Math.max(0, (hEff - Hf) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  const handleFile = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      setImgSrc(e.target.result);
      setZoom(1.2);
      setPan({ x: 0, y: 0 });
      setCropData(null);
    };
    r.readAsDataURL(file);
  };

  const onPointerDown = (e) => {
    const frame = cropFrameRef.current;
    if (!frame) return;
    frame.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      const only = [...pointersRef.current.values()][0];
      dragRef.current = { startX: only.x, startY: only.y, origPan: { ...pan } };
    } else if (pointersRef.current.size === 0) {
      dragRef.current = null;
    }
  };

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1 && dragRef.current) {
      const only = [...pointersRef.current.values()][0];
      const dx = only.x - dragRef.current.startX;
      const dy = only.y - dragRef.current.startY;
      setPan(clampPan(dragRef.current.origPan.x + dx, dragRef.current.origPan.y + dy, zoom));
    }
  };

  const onPointerUp = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 1) {
      const only = [...pointersRef.current.values()][0];
      dragRef.current = { startX: only.x, startY: only.y, origPan: { ...pan } };
    } else if (pointersRef.current.size === 0) {
      dragRef.current = null;
    }
  };

  const captureCrop = useCallback(() => {
    const imgEl = imgElRef.current;
    const frame = cropFrameRef.current;
    if (!imgEl || !frame || !imgEl.naturalWidth) return;
    const rect = frame.getBoundingClientRect();
    const Wf = rect.width, Hf = rect.height;
    const Wi = imgEl.naturalWidth, Hi = imgEl.naturalHeight;
    const OUT_W = 540, OUT_H = 960;
    const k = OUT_W / Wf;
    const containScale = Math.min(Wf / Wi, Hf / Hi);
    const containDw = Wi * containScale, containDh = Hi * containScale;
    const cx = Wf / 2, cy = Hf / 2;
    const p0x = (Wf - containDw) / 2, p0y = (Hf - containDh) / 2;
    const pf0x = cx + (p0x - cx) * zoom + pan.x;
    const pf0y = cy + (p0y - cy) * zoom + pan.y;
    const sEff = k * containScale * zoom;
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W; canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1C1913";
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    try {
      ctx.save();
      ctx.filter = "blur(26px) brightness(0.5)";
      const cover = Math.max(OUT_W / Wi, OUT_H / Hi);
      const cw = Wi * cover, ch = Hi * cover;
      ctx.drawImage(imgEl, (OUT_W - cw) / 2, (OUT_H - ch) / 2, cw, ch);
      ctx.restore();
    } catch (e) {}
    ctx.drawImage(imgEl, k * pf0x, k * pf0y, sEff * Wi, sEff * Hi);
    setCropData(canvas.toDataURL("image/jpeg", 0.92));
  }, [zoom, pan]);

  // Submit Handler integrating server-side API pricing and orders
  const handlePayAndSend = async () => {
    setIsProcessing(true);
    try {
      const formattedRecipients = recipients.map(r => ({
        name: r.name,
        countryCode: r.country.dial,
        phone: r.phone
      }));

      // 1. Create Draft Puzzle
      const puzzleRes = await api.createPuzzle({
        cropData,
        message,
        senderName,
        senderPhone: senderCountry.dial + senderPhone,
        revealIdentity,
        pieceCount,
        recipients: formattedRecipients
      });

      const publicId = puzzleRes.puzzle.publicId;

      // 2. Create Order
      const orderRes = await api.createOrder({
        puzzleId: publicId,
        recipientCount: recipients.length,
        hasRevealAlert: selectedUpgrades.includes("insights")
      });

      const { checkoutUrl, orderId } = orderRes.order;

      // 3. Environment Fallback checking
      const isLocalTest = import.meta.env.VITE_ENABLE_LOCAL_TEST === 'true';
      if (isLocalTest && checkoutUrl.includes('mock-payment.com')) {
        // Automatically verify payment via simulated webhook
        await api.triggerMockPayment(orderId, publicId);

        // Standard delay for orbiting animation feel
        setTimeout(() => {
          setIsProcessing(false);
          setIsSuccess(true);
          setTestLink(`/p/${publicId}?r=0`);
        }, 2600);
      } else {
        // Redirect to production payment gateway checkout session
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      console.error(err);
      alert('Failed to initialize checkout order: ' + (err.response?.data?.error || err.message));
      setIsProcessing(false);
    }
  };

  // View state navigation handlers
  const handleStep1Continue = () => {
    if (cropData) {
      setCurrentStep(2);
    }
  };

  const handleStep2Continue = () => {
    if (primaryRecipientName.trim() && message.trim()) {
      setCurrentStep(3);
    }
  };

  const handleStep3Continue = () => {
    if (step3Ready) {
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentDifficulty = useMemo(() => {
    return PIECE_OPTIONS.find(p => p.count === pieceCount) || PIECE_OPTIONS[2];
  }, [pieceCount]);

  if (isProcessing) {
    return (
      <div className="create-page">
        <div style={{ fontFamily: "Archia, sans-serif", color: T.ink, padding: "34px 20px 70px" }}>
          <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 50 }}>
            <LoaderOrbit />
            <h1 style={{ fontSize: 22, fontWeight: 500, margin: "24px 0 8px", letterSpacing: "-0.01em" }}>Preparing your JIGZO…</h1>
            <p style={{ fontSize: 14, color: T.ink60 }}>This usually takes only a few seconds.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    const displayRecipientsText = recipients.length === 1 
      ? `${recipients[0].name || "They"} will receive a WhatsApp from JIGZO with a puzzle to solve. Your message unlocks with the final piece.`
      : "Your recipients will receive a WhatsApp from JIGZO with a puzzle to solve. Your message unlocks with the final piece.";
    
    return (
      <div className="create-page">
        <div style={{ fontFamily: "Archia, sans-serif", color: T.ink, padding: "34px 20px 70px" }}>
          <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 30 }}>
            <div style={{ width: 84, height: 84, margin: "0 auto 24px", borderRadius: "50%", background: T.ink,
              display: "flex", alignItems: "center", justifyContent: "center", animation: "ckPop 0.5s cubic-bezier(.2,.8,.2,1) both" }}>
              <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
                <path d="M11 22 L18 29 L31 14" stroke={T.goldWarm} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="40" strokeDashoffset="40" style={{ animation: "ckDraw 0.5s ease 0.35s forwards" }} />
              </svg>
            </div>
            <h1 style={{ fontSize: 27, fontWeight: 300, margin: "0 0 12px", letterSpacing: "-0.02em" }}>Your JIGZO has been delivered.</h1>
            <p style={{ fontSize: 14.5, color: T.ink66, margin: "0 auto 26px", maxWidth: 360, lineHeight: 1.6 }}>
              {displayRecipientsText}
            </p>
            {testLink && (
              <PrimaryButton onClick={() => window.open(testLink, "_blank")} style={{ width: "100%" }}>
                Open the reveal link (local test)
              </PrimaryButton>
            )}
            <p style={{ fontSize: 11.5, color: T.ink50, marginTop: 12, lineHeight: 1.5 }}>
              Prototype simulation — did not process a real payment or send a real WhatsApp. Click above to test the solve flow locally.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-page" style={{ fontFamily: "Archia, sans-serif", color: T.ink, padding: "34px 20px 70px" }}>
      <style>{`
        ::placeholder { color: ${T.ink40}; }
        textarea, input, select { font-family: 'Archia', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ckPop { 0%{ transform:scale(0); } 70%{ transform:scale(1.12); } 100%{ transform:scale(1); } }
        @keyframes ckDraw { to { stroke-dashoffset:0; } }
      `}</style>

      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <StepProgressBar step={currentStep} />

        {/* ============ STEP 1 — CREATE ============ */}
        {currentStep === 1 && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Create your puzzle</h1>
            <p style={{ fontSize: 14.5, color: T.ink66, margin: "0 0 20px", lineHeight: 1.5 }}>
              Choose the photo they’ll uncover. We’ll turn it into the puzzle that hides your message.
            </p>

            {!imgSrc && (
              <div
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                onDragOver={(e) => e.preventDefault()}
                style={{ border: "1.5px dashed " + T.ink15, borderRadius: 18, padding: "48px 20px",
                  textAlign: "center", cursor: "pointer", background: T.card }}
              >
                <div style={{ width: 54, height: 54, margin: "0 auto 14px", filter: "drop-shadow(0 6px 14px rgba(124,76,34,0.35))" }}>
                  <PuzzleBadge size={54} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 15.5, marginBottom: 4 }}>Upload a photo</div>
                <div style={{ fontSize: 12.5, color: T.ink50 }}>JPG or PNG</div>
              </div>
            )}

            {imgSrc && !cropData && (
              <div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <div
                    ref={cropFrameRef}
                    style={{ position: "relative", width: "100%", maxWidth: 300, aspectRatio: "9 / 16", borderRadius: 20,
                      overflow: "hidden", background: T.ink, cursor: "grab", touchAction: "none", margin: "0 auto",
                      boxShadow: "0 0 0 2px " + T.bg + ", 0 0 0 3px " + T.ink08 }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onPointerLeave={onPointerUp}
                  >
                    <img src={imgSrc} alt="" aria-hidden="true" draggable={false}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                        filter: "blur(18px) brightness(0.5)", transform: "scale(1.15)", userSelect: "none", pointerEvents: "none" }} />
                    <img ref={imgElRef} src={imgSrc} alt="" draggable={false}
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain",
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center",
                        userSelect: "none", pointerEvents: "none" }} />
                    {[{ top: 10, left: 10 }, { top: 10, right: 10 }, { bottom: 10, left: 10 }, { bottom: 10, right: 10 }].map((pos, i) => (
                      <div key={i} style={{ position: "absolute", width: 16, height: 16, border: "2px solid " + T.goldBright, pointerEvents: "none",
                        ...(pos.top !== undefined ? { top: pos.top, borderBottom: "none" } : { bottom: pos.bottom, borderTop: "none" }),
                        ...(pos.left !== undefined ? { left: pos.left, borderRight: "none" } : { right: pos.right, borderLeft: "none" }) }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 20px" }}>
                  <span style={{ fontSize: 18 }}>−</span>
                  <input type="range" min="1" max="3" step="0.01" value={zoom}
                    onChange={(e) => { const z = parseFloat(e.target.value); setZoom(z); setPan((p) => clampPan(p.x, p.y, z)); }}
                    style={{ flex: 1, accentColor: T.gold }} />
                  <span style={{ fontSize: 18 }}>+</span>
                </div>
                <div className="footer-nav">
                  <GhostButton onClick={() => setImgSrc(null)}>Cancel</GhostButton>
                  <PrimaryButton onClick={captureCrop} style={{ flex: 1 }}>Crop Photo</PrimaryButton>
                </div>
              </div>
            )}

            {cropData && (
              <div style={{ animation: "fadeUp 0.4s ease" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                  <div style={{ position: "relative", width: "100%", maxWidth: 170, aspectRatio: "9 / 16", borderRadius: 14,
                    overflow: "hidden", boxShadow: T.shadowRest, border: "1px solid " + T.ink08 }}>
                    <img src={cropData} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => { setCropData(null); setZoom(1.2); setPan({ x: 0, y: 0 }); }} className="edit-btn"
                      style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)" }}>Change</button>
                  </div>
                </div>

                {!difficultyOpen ? (
                  <div className="difficulty-summary">
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink40, marginBottom: 2 }}>Puzzle difficulty</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{currentDifficulty.label} · {currentDifficulty.pieces}</div>
                    </div>
                    <button type="button" onClick={() => setDifficultyOpen(true)} className="btn-change">Change</button>
                  </div>
                ) : (
                  <div style={{ padding: 18, borderRadius: 16, background: T.card, border: "1px solid " + T.ink08, marginBottom: 18, animation: "fadeUp 0.3s ease" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink40, marginBottom: 10 }}>Select difficulty</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {PIECE_OPTIONS.map((opt) => {
                        const isSel = opt.count === pieceCount;
                        return (
                          <button type="button" key={opt.count} onClick={() => { setPieceCount(opt.count); setDifficultyOpen(false); }} className={`difficulty-option ${isSel ? "active" : ""}`}
                            style={{ display: "block", width: "100%", padding: "14px 16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>{opt.label}</span>
                              <span style={{ fontSize: 11.5, fontWeight: 500, color: isSel ? T.bg : T.ink50, background: isSel ? T.ink : "rgba(28,25,19,0.06)", padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>{opt.pieces}</span>
                            </div>
                            <div style={{ fontSize: 12.5, color: isSel ? T.ink74 : T.ink66, textAlign: "left", lineHeight: 1.4 }}>{opt.copy}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="footer-nav" style={{ marginTop: 24 }}>
                  <PrimaryButton onClick={handleStep1Continue} style={{ flex: 1 }}>Continue</PrimaryButton>
                </div>
              </div>
            )}

            <input type="file" ref={fileInputRef} onChange={(e) => handleFile(e.target.files[0])} accept="image/*" style={{ display: "none" }} />
          </div>
        )}

        {/* ============ STEP 2 — PERSONALIZE ============ */}
        {currentStep === 2 && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Who is this for?</h1>
            <p style={{ fontSize: 14.5, color: T.ink66, margin: "0 0 20px", lineHeight: 1.5 }}>
              Write their name, and choose occasion keywords to find suggested messages.
            </p>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink50, marginBottom: 6 }}>Recipient’s Name</label>
              <input type="text" placeholder="e.g. Sofia, Mom, Alex" value={primaryRecipientName}
                onChange={(e) => handlePrimaryRecipientNameChange(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink50, marginBottom: 8 }}>What's the occasion?</label>
              <div className={`occasions-chips-wrapper ${occasion ? "chips-container-has-selection" : ""}`} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {OCCASIONS.map((o) => (
                  <button type="button" key={o.id} onClick={() => { setOccasion(o.id); pickCombo(o.id, tone); }}
                    className={`occasion-chip ${o.id === occasion ? "active" : ""}`}>{o.label}</button>
                ))}
              </div>
            </div>

            {occasion && (
              <div style={{ marginBottom: 18, animation: "fadeUp 0.3s ease" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink50, marginBottom: 8 }}>Choose a tone</label>
                <div className={`tones-chips-wrapper ${tone ? "chips-container-has-selection" : ""}`} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {TONES.map((t) => (
                    <button type="button" key={t.id} onClick={() => { setTone(t.id); pickCombo(occasion, t.id); }}
                      className={`tone-chip ${t.id === tone ? "active" : ""}`}>{t.label}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink50 }}>Hidden Message</label>
                {occasion && tone && suggestedMessage(occasion, tone) && (
                  <button type="button" onClick={useSuggested} className="btn-suggested">Insert suggested message</button>
                )}
              </div>
              <textarea placeholder="Write your hidden message here..." value={message} onChange={(e) => setMessage(e.target.value)}
                style={{ ...inputStyle, resize: "none", height: 110, lineHeight: 1.5, padding: 14 }} />
            </div>

            <div className="footer-nav">
              <GhostButton onClick={handleBack}>Back</GhostButton>
              <PrimaryButton onClick={handleStep2Continue} disabled={!primaryRecipientName.trim() || !message.trim()} style={{ flex: 1 }}>Continue</PrimaryButton>
            </div>
          </div>
        )}

        {/* ============ STEP 3 — SEND ============ */}
        {currentStep === 3 && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Set up delivery</h1>
            <p style={{ fontSize: 14.5, color: T.ink66, margin: "0 0 20px", lineHeight: 1.5 }}>
              Puzzles are delivered directly through WhatsApp. Select a plan based on the number of recipients.
            </p>

            <div onClick={() => setPackageAccordionOpen(!packageAccordionOpen)} role="button" aria-expanded={packageAccordionOpen}
              style={{ padding: 18, borderRadius: 16, background: T.card, border: "1.5px solid " + T.ink15, marginBottom: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink40, marginBottom: 2 }}>Current Package</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{currentPack.label} · Up to {currentPack.limit} {currentPack.limit === 1 ? "recipient" : "recipients"} · ${currentPack.price}</div>
              </div>
              <span style={{ fontSize: 12 }}>{packageAccordionOpen ? "▲" : "▼"}</span>
            </div>

            {packageAccordionOpen && (
              <div style={{ padding: 16, borderRadius: 16, background: T.card, border: "1px solid " + T.ink08, marginBottom: 16, animation: "fadeUp 0.3s ease" }}>
                <div style={{ fontSize: 12, color: T.ink50, marginBottom: 12, lineHeight: 1.4 }}>
                  Your plan is selected automatically based on the number of recipients.
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink40, marginBottom: 10 }}>Available Plans</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {PACK_OPTIONS.map((pack) => {
                    const isSel = pack.id === currentPack.id;
                    return (
                      <div key={pack.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 10, border: isSel ? "1.5px solid " + T.ink : "1px solid " + T.ink08, background: isSel ? "rgba(28,25,19,0.02)" : "transparent" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14.5, display: "flex", alignItems: "center", gap: 6 }}>
                            <span>{pack.label}</span>
                            {isSel && (
                              <span style={{ fontSize: 10.5, fontWeight: 700, background: T.goldWarm, color: T.ink, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap", display: "inline-block" }}>
                                Active
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: T.ink66, marginTop: 4 }}>Up to {pack.limit} {pack.limit === 1 ? "recipient" : "recipients"}</div>
                        </div>
                        <span style={{ fontFamily: T.mono, fontWeight: 600, fontSize: 15, color: T.ink }}>${pack.price}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recipient Details List */}
            {recipients.map((rec, idx) => {
              const recTouched = rec.name || rec.phone;
              const recValid = phoneValid(rec.country.dial + rec.phone);
              const fullPhone = rec.country.dial + rec.phone;
              const isDuplicate = rec.phone && recipients.some((r, i) => i !== idx && (r.country.dial + r.phone) === fullPhone);
              return (
                <div key={idx} style={{ padding: 18, borderRadius: 16, background: T.card, border: "1px solid " + T.ink08, marginBottom: 16, position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontWeight: 600, fontSize: 14.5 }}>Recipient #{idx + 1}</span>
                    {recipients.length > 1 && (
                      <button type="button" onClick={() => setRecipients(prev => prev.filter((_, i) => i !== idx))} className="edit-btn">Remove</button>
                    )}
                  </div>
                  <input type="text" placeholder="Recipient name" value={rec.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (idx === 0) setPrimaryRecipientName(val);
                      setRecipients(prev => {
                        const next = [...prev];
                        next[idx].name = val;
                        return next;
                      });
                    }}
                    style={{ ...inputStyle, marginBottom: 14 }}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <select
                      value={rec.country.code}
                      onChange={(e) => {
                        const code = e.target.value;
                        const country = COUNTRIES.find(c => c.code === code);
                        setRecipients(prev => {
                          const next = [...prev];
                          next[idx].country = country;
                          return next;
                        });
                      }}
                      style={{ ...inputStyle, width: "auto", flex: "none", padding: "13px 8px" }}
                    >
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>)}
                    </select>
                    <input type="tel" placeholder="Phone number" value={rec.phone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRecipients(prev => {
                          const next = [...prev];
                          next[idx].phone = val;
                          return next;
                        });
                      }}
                      aria-invalid={recTouched && rec.phone && !recValid ? "true" : "false"}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                  </div>

                  {rec.phone && (!recValid || isDuplicate) && (
                    <div style={{ marginTop: 8, fontSize: 12.5, color: T.goldDeep, fontWeight: 500, textAlign: "left", display: "flex", alignItems: "center", gap: 4 }}>
                      <span>⚠️</span>
                      <span>
                        {!recValid 
                          ? "Please enter a valid phone number (7 to 12 digits)." 
                          : "Duplicate phone number. Each recipient must be unique."
                        }
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {recipients.length < 50 && (
              <button type="button" onClick={() => setRecipients(prev => [...prev, { name: "", phone: "", country: COUNTRIES[0] }])} className="add-recipient-btn">
                + Add another recipient
              </button>
            )}

            {/* Sender Details */}
            <div style={{ padding: 18, borderRadius: 16, background: T.card, border: "1px solid " + T.ink08, margin: "16px 0" }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 12 }}>Sender details</div>
              <input type="text" placeholder="Your name (as you want it shown)" value={senderName} onChange={(e) => setSenderName(e.target.value)}
                style={{ ...inputStyle, marginBottom: 14 }} />
              <div style={{ display: "flex", gap: 10 }}>
                <select value={senderCountry.code} onChange={(e) => setSenderCountry(COUNTRIES.find(c => c.code === e.target.value))}
                  style={{ ...inputStyle, width: "auto", flex: "none", padding: "13px 8px" }}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>)}
                </select>
                <input type="tel" placeholder="Your phone number" value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }} />
              </div>

              {senderPhone && !senderValid && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: T.goldDeep, fontWeight: 500, textAlign: "left", display: "flex", alignItems: "center", gap: 4 }}>
                  <span>⚠️</span>
                  <span>Please enter a valid phone number (7 to 12 digits).</span>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14 }}>
                <input type="checkbox" id="show-identity" checked={revealIdentity} onChange={(e) => setRevealIdentity(e.target.checked)} style={{ marginTop: 4, flex: "none" }} />
                <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                  <label htmlFor="show-identity" style={{ fontWeight: 600, cursor: "pointer" }}>Show who this JIGZO is from</label>
                  <p style={{ fontSize: 12.5, color: T.ink50, margin: "6px 0 0", lineHeight: 1.4 }}>
                    Turn this off to keep the first notification anonymous. Your signed message can still include your name.
                  </p>
                </div>
              </div>
            </div>

            <Disclosure title="Preview their WhatsApp message">
              <WhatsAppPreview senderName={senderName} showIdentity={revealIdentity} receiverName={recipients[0]?.name} />
            </Disclosure>

            <div className="footer-nav">
              <GhostButton onClick={handleBack}>Back</GhostButton>
              <PrimaryButton onClick={handleStep3Continue} disabled={!step3Ready} style={{ flex: 1 }}>Continue</PrimaryButton>
            </div>
          </div>
        )}

        {/* ============ STEP 4 — REVIEW & PAY ============ */}
        {currentStep === 4 && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Review and send</h1>
            <p style={{ fontSize: 14.5, color: T.ink66, margin: "0 0 20px", lineHeight: 1.5 }}>
              Check the details before your JIGZO is delivered.
            </p>

            <div style={{ padding: 18, borderRadius: 16, background: T.card, border: "1px solid " + T.ink08, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
                {cropData && (
                  <div style={{ position: "relative", flex: "none" }}>
                    <img src={cropData} alt="" style={{ width: 52, height: 92, objectFit: "cover", borderRadius: 8 }} />
                    <button type="button" onClick={() => setCurrentStep(1)} className="edit-btn" style={{ display: "block", marginTop: 4, textAlign: "center", width: "100%" }}>Edit</button>
                  </div>
                )}
                <div style={{ fontSize: 13.5, lineHeight: 1.7, flex: 1 }}>
                  <div><strong>Recipients ({recipients.length})</strong> · {recipients.map(r => r.name || "—").join(", ")} <button type="button" onClick={() => setCurrentStep(3)} className="edit-btn">Edit</button></div>
                  <div style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 260 }}>
                    <strong>Message</strong> · "{message}" <button type="button" onClick={() => setCurrentStep(2)} className="edit-btn">Edit</button>
                  </div>
                  <div><strong>Difficulty</strong> · {currentDifficulty.label} ({pieceCount} pieces) <button type="button" onClick={() => setCurrentStep(1)} className="edit-btn">Edit</button></div>
                  <div><strong>Sender shown</strong> · {revealIdentity ? `Yes (${senderName})` : "Anonymous"} <button type="button" onClick={() => setCurrentStep(3)} className="edit-btn">Edit</button></div>
                </div>
              </div>
            </div>

            <Disclosure title="Preview the reveal layout">
              <div style={{ display: "flex", justifyContent: "center", margin: "14px 0" }}>
                <div style={{ position: "relative", width: 170, aspectRatio: "9 / 16", borderRadius: 20,
                  boxShadow: "0 4px 18px rgba(0,0,0,0.18), 0 0 0 3px #050505", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0 }}>
                    <RevealFace photo={cropData} toName={recipients[0]?.name} fromName={senderName} message={message} />
                  </div>
                </div>
              </div>
            </Disclosure>

            {UPGRADES.map((u) => {
              const selected = selectedUpgrades.includes(u.id);
              const priceVal = getUpgradePrice(u.id);
              return (
                <div key={u.id} onClick={() => toggleUpgrade(u.id)} role="button" aria-pressed={selected}
                  style={{ border: selected ? "2px solid " + T.ink : "1.5px solid " + T.ink15,
                    background: selected ? "rgba(28,25,19,0.04)" : T.card, borderRadius: 16, padding: 18,
                    marginBottom: 16, cursor: "pointer", transition: "border-color 0.2s ease, background 0.2s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 15.5, flex: 1 }}>{u.name}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.ink }}>Add for {formatPrice(priceVal)}</div>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", flex: "none",
                      border: selected ? "1.5px solid " + T.ink : "1.5px solid rgba(28, 25, 19, 0.3)",
                      background: selected ? T.ink : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {selected && (
                        <svg width="10" height="10" viewBox="0 0 13 13" fill="none">
                          <path d="M3 7 L5.5 9.5 L10 4" stroke={T.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.goldDeep, marginBottom: 4 }}>{u.tagline}</div>
                  <div style={{ fontSize: 12.5, color: T.ink66, lineHeight: 1.4 }}>{u.description}</div>
                </div>
              );
            })}

            <div style={{ padding: 16, borderRadius: 14, background: T.card, border: "1px solid " + T.ink08, marginBottom: 16 }}>
              <div className="price-row">
                <span>{currentPack.label} ({recipients.length} {recipients.length === 1 ? "recipient" : "recipients"})</span>
                <span>{formatPrice(BASE_PRICE)}</span>
              </div>
              {selectedUpgrades.includes("insights") && (
                <div className="price-row">
                  <span>Reveal Alert Add-on</span>
                  <span>+{formatPrice(getUpgradePrice("insights"))}</span>
                </div>
              )}
              <div className="price-row total">
                <span>Total</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '20px', background: T.card, borderRadius: 16, border: '1.5px solid ' + T.ink15, margin: "20px 0" }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, color: T.ink }}>JIGZO is launching soon</h2>
              <p style={{ fontSize: 13.5, color: T.ink66, lineHeight: 1.4, marginBottom: 14 }}>
                Leave your details and we’ll let you know when sending opens.
              </p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <input type="email" placeholder="Your email address" style={{ ...inputStyle, flex: 1 }} disabled />
                <PrimaryButton disabled style={{ flex: 'none', padding: '10px 20px' }}>Notify Me</PrimaryButton>
              </div>
              <div style={{ fontSize: 12, color: T.goldDeep, fontWeight: 600 }}>
                No payment will be taken.
              </div>
            </div>

            <div className="footer-nav">
              <GhostButton onClick={handleBack}>Back</GhostButton>
              <PrimaryButton disabled style={{ flex: 1 }}>Pay &amp; Send</PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatPrice(num) {
  return `$${num}`;
}
