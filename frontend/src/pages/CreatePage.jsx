import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { packageForRecipientCount } from '../services/pricing';
import { COUNTRIES } from '../config/countries';
import { formatMoney, resolveVisitorCurrency } from '../services/jigzoPricing';
import { PACK_OPTIONS, UPGRADES } from '../config/packages';
import { PIECE_OPTIONS, OCCASIONS, TONES, suggestedMessage } from '../config/difficulties';
import WhatsAppPreview from '../components/WhatsAppPreview';
import RevealFace from '../components/RevealFace';
import LoaderOrbit from '../components/LoaderOrbit';
import RevealBeat from '../components/RevealBeat';
import { buildEdgeMap, piecePath, mulberry32 } from '../puzzle/puzzle-shape';
import { analytics } from '../services/analytics';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { normalizePhoneInput } from '../utils/phone';

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
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const labels = [
    t('create.progress.step1'),
    t('create.progress.step2'),
    t('create.progress.step3'),
    t('create.progress.step4')
  ];
  const stepText = isAr
    ? `الخطوة ${step} من 4 — ${labels[step - 1]}`
    : `Step ${step} of 4 — ${labels[step - 1]}`;
  return (
    <div style={{ marginBottom: 28, direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="progress-bar" style={{ display: 'flex', flexDirection: isAr ? 'row-reverse' : 'row' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`progress-bar__seg ${i <= step ? "progress-bar__seg--active" : ""}`} />
        ))}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, letterSpacing: "0.02em", textAlign: isAr ? 'right' : 'left' }} aria-current="step">
        {stepText}
      </div>
    </div>
  );
}

function phoneDigits(v) { return normalizePhoneInput(v).replace(/\D/g, ""); }
// Strong format validation via libphonenumber-js. Accepts any structurally
// valid number regardless of line type (we do not require it to classify as
// mobile, and we never claim a number is "WhatsApp verified"). The dial + phone
// are normalized first so Arabic-Indic/Persian digits and RTL marks validate
// identically to English input (and match the backend's normalized value).
function phoneValid(dial, phone) {
  const full = normalizePhoneInput(`${dial || ""}${phone || ""}`);
  if (!full) return false;
  try {
    return isValidPhoneNumber(full.startsWith("+") ? full : `+${full}`);
  } catch (e) {
    return false;
  }
}
function emailValid(v) {
  const e = String(v || "").trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function CreatePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  // Active language flag, shared by every helper inside this component.
  // Defined once here so all render branches (delivery, review, success)
  // resolve the same value — previously only StepProgressBar had a local
  // `isAr`, so references in CreatePage's body threw "isAr is not defined".
  const isAr = i18n.language === 'ar';

  const [currency, setCurrency] = useState(resolveVisitorCurrency());

  useEffect(() => {
    const handlePricingUpdate = () => {
      setCurrency(resolveVisitorCurrency());
    };
    window.addEventListener('jigzo-pricing-updated', handlePricingUpdate);
    return () => {
      window.removeEventListener('jigzo-pricing-updated', handlePricingUpdate);
    };
  }, []);

  const [currentStep, setCurrentStep] = useState(1);
  const [imgSrc, setImgSrc] = useState(null);
  const [cropData, setCropData] = useState(null);
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderDial, setSenderDial] = useState("+973");
  const [defaultDialCode, setDefaultDialCode] = useState("+973");
  const [recipients, setRecipients] = useState([
    { name: "", phone: "", dial: "+973", dialEdited: false, deliveryMethod: "whatsapp", email: "" }
  ]);
  const [revealIdentity, setRevealIdentity] = useState(true);
  const [pieceCount, setPieceCount] = useState(18);
  const [selectedUpgrades, setSelectedUpgrades] = useState([]);
  const [occasion, setOccasion] = useState("");
  const [tone, setTone] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [testLink, setTestLink] = useState("");
  const [interestEmail, setInterestEmail] = useState("");
  const [interestRegistered, setInterestRegistered] = useState(false);
  const [interestRegistering, setInterestRegistering] = useState(false);
  const [revealSimSolved, setRevealSimSolved] = useState(false);
  const [revealSimLoading, setRevealSimLoading] = useState(false);
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(false);
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [createdPuzzleId, setCreatedPuzzleId] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [processingContext, setProcessingContext] = useState("");
  const [testModeResult, setTestModeResult] = useState(null);

  useEffect(() => {
    setCreatedPuzzleId("");
    setPaymentError("");
    setProcessingContext("");
  }, [
    cropData,
    message,
    senderName,
    senderPhone,
    senderDial,
    revealIdentity,
    pieceCount,
    recipients,
    i18n.language
  ]);

  useEffect(() => {
    const handlePageShow = (e) => {
      if (e.persisted) {
        setIsProcessing(false);
        setProcessingContext("");
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => {
    const checkFeatures = async () => {
      try {
        const res = await api.getFeaturesStatus();
        setCheckoutEnabled(res.checkoutEnabled);
        setIsTestModeEnabled(res.testRevealEnabled);
      } catch (err) {
        console.error('Error fetching features status:', err);
      }
    };
    checkFeatures();
  }, []);



  const [primaryRecipientName, setPrimaryRecipientName] = useState("");

  // Crop Zoom & Pan States
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const pointersRef = useRef(new Map());
  const dragRef = useRef(null);
  const pinchRef = useRef(null);

  const fileInputRef = useRef(null);
  const cropFrameRef = useRef(null);
  const imgElRef = useRef(null);

  const senderPhoneRef = useRef("");
  const senderDialEditedRef = useRef(false);

  useEffect(() => {
    senderPhoneRef.current = senderPhone;
  }, [senderPhone]);

  useEffect(() => {
    let isMounted = true;
    const loadGeoLocale = async () => {
      try {
        const res = await fetch('/api/pricing/locale');
        if (!res.ok) throw new Error('Locale request failed');
        const data = await res.json();
        if (data && data.success && data.country) {
          const countryMatch = COUNTRIES.find(c => c.code === data.country.toUpperCase());
          if (countryMatch && countryMatch.dial) {
            const resolvedDial = countryMatch.dial;
            if (isMounted) {
              setDefaultDialCode(resolvedDial);
              setSenderDial(prev => {
                if (senderPhoneRef.current === "" && !senderDialEditedRef.current) {
                  return resolvedDial;
                }
                return prev;
              });
              setRecipients(prevRecs => {
                return prevRecs.map(r => {
                  if (r.phone === "" && !r.dialEdited) {
                    return { ...r, dial: resolvedDial };
                  }
                  return r;
                });
              });
            }
          }
        }
      } catch (err) {
        console.error('Error fetching pricing locale:', err);
      }
    };
    loadGeoLocale();
    return () => {
      isMounted = false;
    };
  }, []);

  // Scroll-to-top ONLY on major step/view transitions
  useEffect(() => {
    window.scrollTo(0, 0);
    setRevealSimSolved(false);
    setRevealSimLoading(false);
  }, [currentStep]);

  // Track create_started once on mount
  useEffect(() => {
    analytics.track('create_started');
  }, []);

  // Track review opened and checkout blocked when entering Step 4
  useEffect(() => {
    if (currentStep === 4) {
      analytics.track('review_opened', {
        difficulty: pieceCount,
        hasRevealAlert: selectedUpgrades.includes('insights'),
        recipientsCount: recipients.length
      });
      analytics.track('checkout_blocked', {
        reason: 'CHECKOUT_DISABLED_LAUNCH_LOCK'
      });
    }
  }, [currentStep]);

  // Sync recipient #1 name with primary recipient name
  const handlePrimaryRecipientNameChange = (val) => {
    setPrimaryRecipientName(val);
    setRecipients(prev => {
      const next = [...prev];
      if (next[0]) {
        next[0] = { ...next[0], name: val };
      } else {
        next[0] = { name: val, phone: "", dial: defaultDialCode, dialEdited: false, deliveryMethod: "whatsapp", email: "" };
      }
      return next;
    });
  };

  const currentPack = useMemo(() => {
    return packageForRecipientCount(recipients.length);
  }, [recipients.length]);

  const BASE_PRICE = currentPack.price;

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

  // Jigsaw SVG Preview pieces calculation
  const previewPieces = useMemo(() => {
    const Wf = 170, Hf = 302;
    const opt = PIECE_OPTIONS.find(o => o.count === pieceCount) || PIECE_OPTIONS[2];
    const cols = opt.cols;
    const rows = opt.rows;
    const pw = Wf / cols;
    const ph = Hf / rows;
    const edgeMap = buildEdgeMap(cols, rows, 42);

    const tabPad = 0.46 * Math.max(pw, ph);
    const elemW = pw + tabPad * 2;
    const elemH = ph + tabPad * 2;

    const paths = [];
    const rand = mulberry32(101);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const d = piecePath(r, c, cols, rows, pw, ph, edgeMap);

        // Scatter puzzle pieces randomly across the 170x302 phone stage
        const minX = 6, maxX = Wf - pw - 6;
        const minY = 6, maxY = Hf - ph - 6;
        const posX = minX + rand() * (maxX - minX);
        const posY = minY + rand() * (maxY - minY);
        const angle = (rand() - 0.5) * 60;

        paths.push({
          r,
          c,
          d,
          posX,
          posY,
          angle,
          pw,
          ph,
          tabPad,
          elemW,
          elemH
        });
      }
    }
    return paths;
  }, [pieceCount]);

  // Country Dial Selectors
  const senderValid = phoneValid(senderDial, senderPhone);

  const getCountryCodeFromDial = (dialVal) => {
    const match = COUNTRIES.find(c => c.dial === dialVal);
    return match ? match.code : "UNKNOWN";
  };

  const sanitizeDialCode = (val) => {
    // Normalize first so an Arabic-Indic/Persian-typed dial code (e.g. +٩٧٣)
    // and any RTL marks collapse to a clean "+973" before the digit filter.
    const normalized = normalizePhoneInput(val);
    let sanitized = normalized.replace(/[^\d+]/g, '');
    if (sanitized.includes('+')) {
      const hasLeadingPlus = normalized.startsWith('+');
      sanitized = sanitized.replace(/\+/g, '');
      if (hasLeadingPlus) {
        sanitized = '+' + sanitized;
      }
    }
    return sanitized;
  };

  const recipientNumbers = useMemo(() => {
    return recipients.map(r => r.dial + r.phone);
  }, [recipients]);

  const recipientsValid = useMemo(() => {
    const identitySet = new Set();
    for (const r of recipients) {
      if (!r.name.trim()) return false;
      const method = r.deliveryMethod === "email" ? "email" : "whatsapp";
      if (method === "email") {
        if (!emailValid(r.email)) return false;
        const id = "email:" + String(r.email || "").trim().toLowerCase();
        if (identitySet.has(id)) return false;
        identitySet.add(id);
      } else {
        if (!phoneValid(r.dial, r.phone)) return false;
        const id = "phone:" + (r.dial + r.phone);
        if (identitySet.has(id)) return false;
        identitySet.add(id);
      }
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
      setRotation(0);
      setCropData(null);
      analytics.track('photo_uploaded');
    };
    r.readAsDataURL(file);
  };

  const onPointerDown = (e) => {
    const frame = cropFrameRef.current;
    if (!frame) return;
    if (e.pointerType === "touch" && frame.setPointerCapture) {
      try { frame.setPointerCapture(e.pointerId); } catch (_) {}
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const size = pointersRef.current.size;
    if (size === 2) {
      const pts = [...pointersRef.current.values()];
      const a = pts[0], b = pts[1];
      const r = frame.getBoundingClientRect();
      const curAngle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      pinchRef.current = {
        startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        startZoom: zoom,
        startPan: { ...pan },
        lastAngle: curAngle,
        startMid: { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top },
        C: { x: r.width / 2, y: r.height / 2 },
      };
      dragRef.current = null;
    } else if (size === 1) {
      dragRef.current = { startX: e.clientX, startY: e.clientY, origPan: { ...pan } };
    }
  };

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const a = pts[0], b = pts[1];
      const frame = cropFrameRef.current, r = frame.getBoundingClientRect();
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const curMid = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
      const g = pinchRef.current;
      const z1 = Math.max(1, Math.min(3, g.startZoom * (dist / g.startDist)));
      const ratio = z1 / g.startZoom;
      const px = (curMid.x - g.C.x) - ratio * (g.startMid.x - g.C.x - g.startPan.x);
      const py = (curMid.y - g.C.y) - ratio * (g.startMid.y - g.C.y - g.startPan.y);

      const curAngle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      let angleDiff = curAngle - g.lastAngle;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;
      g.lastAngle = curAngle;

      setZoom(z1);
      setRotation(prev => prev + angleDiff);
      setPan(clampPan(px, py, z1));
      return;
    }
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan(clampPan(dragRef.current.origPan.x + dx, dragRef.current.origPan.y + dy, zoom));
  };

  const onPointerUp = (e) => {
    const frame = cropFrameRef.current;
    if (e && e.pointerId != null) {
      if (frame && frame.releasePointerCapture) {
        try { frame.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      pointersRef.current.delete(e.pointerId);
    } else {
      pointersRef.current.clear();
    }
    if (pointersRef.current.size < 2) pinchRef.current = null;
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
      ctx.filter = "none";
    } catch (e) {
      ctx.filter = "none";
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.save();
    // 1. Translate to crop center
    ctx.translate(OUT_W / 2, OUT_H / 2);
    // 2. Apply scaled pan offset
    ctx.translate(pan.x * k, pan.y * k);
    // 3. Rotate
    ctx.rotate(rotation * Math.PI / 180);
    // 4. Scale using same contain scale and zoom as preview
    const sEff = containScale * zoom * k;
    ctx.scale(sEff, sEff);
    // 5. Draw image centered
    ctx.drawImage(imgEl, -Wi / 2, -Hi / 2, Wi, Hi);
    ctx.restore();

    setCropData(canvas.toDataURL("image/jpeg", 0.92));
    analytics.track('photo_cropped');
  }, [zoom, pan, rotation]);

  // Submit Handler integrating server-side API pricing and orders
  const handlePayAndSend = async () => {
    setIsProcessing(true);
    setProcessingContext("payment");
    try {
      const formattedRecipients = recipients.map(r => {
        const method = r.deliveryMethod === "email" ? "email" : "whatsapp";
        if (method === "email") {
          return {
            name: r.name,
            deliveryMethod: "email",
            email: String(r.email || "").trim().toLowerCase()
          };
        }
        return {
          name: r.name,
          deliveryMethod: "whatsapp",
          countryCode: normalizePhoneInput(r.dial),
          phone: normalizePhoneInput(r.phone)
        };
      });

      // 1. Create Draft Puzzle
      let publicId = createdPuzzleId;
      if (!publicId) {
        analytics.track('checkout_started', {
          amount: grandTotal,
          recipientsCount: recipients.length
        });

        const puzzleRes = await api.createPuzzle({
          cropData,
          message,
          senderName,
          senderPhone: normalizePhoneInput(`${senderDial}${senderPhone}`),
          revealIdentity,
          pieceCount,
          recipients: formattedRecipients,
          experienceLanguage: i18n.language
        });

        publicId = puzzleRes.puzzle.publicId;
        setCreatedPuzzleId(publicId);
      }

      // 2. Create Order
      const orderRes = await api.createOrder({
        puzzleId: publicId,
        recipientCount: recipients.length,
        hasRevealAlert: selectedUpgrades.includes("insights"),
        currency: resolveVisitorCurrency()
      });

      const { checkoutUrl, orderId } = orderRes.order;

      // 3. Environment Fallback checking
      const isLocalTest = import.meta.env.VITE_ENABLE_LOCAL_TEST === 'true';
      if (isLocalTest && checkoutUrl.includes('mock-payment.com')) {
        analytics.track('payment_started', { orderId, isLocalTest: true });
        // Automatically verify payment via simulated webhook
        await api.triggerMockPayment(orderId, publicId);
        analytics.track('payment_succeeded', { orderId, puzzleId: publicId });

        // Standard delay for orbiting animation feel
        setTimeout(() => {
          setIsProcessing(false);
          setIsSuccess(true);
          setTestLink(`/p/${publicId}?r=0`);
        }, 2600);
      } else {
        analytics.track('payment_started', { orderId, isLocalTest: false });
        // Redirect to production payment gateway checkout session
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      console.error(err);
      const safeMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message || t('create.review.paymentErrorFallback');
      setPaymentError(safeMsg);
      setIsProcessing(false);
    }
  };

  const handleCreateTestReveal = async () => {
    setIsProcessing(true);
    setProcessingContext("test");
    try {
      const formattedRecipients = recipients.map(r => {
        const method = r.deliveryMethod === "email" ? "email" : "whatsapp";
        if (method === "email") {
          return {
            name: r.name,
            deliveryMethod: "email",
            email: String(r.email || "").trim().toLowerCase()
          };
        }
        return {
          name: r.name,
          deliveryMethod: "whatsapp",
          countryCode: normalizePhoneInput(r.dial),
          phone: normalizePhoneInput(r.phone)
        };
      });


      const res = await api.createTestReveal({
        cropData,
        message,
        senderName,
        senderPhone: normalizePhoneInput(`${senderDial}${senderPhone}`),
        revealIdentity,
        pieceCount,
        recipients: formattedRecipients,
        occasion,
        tone,
        experienceLanguage: i18n.language
      });

      const expectedCount = formattedRecipients.length;
      const links = res.recipientLinks;
      let errorMsg = null;

      if (!Array.isArray(links)) {
        errorMsg = "recipientLinks is not an array";
      } else if (links.length !== expectedCount) {
        errorMsg = `recipientLinks length (${links.length}) does not match expected recipient count (${expectedCount})`;
      } else {
        const indexes = links.map(l => l.recipientIndex);
        const uniqueIndexes = new Set(indexes);
        if (uniqueIndexes.size !== expectedCount) {
          errorMsg = "duplicate recipientIndex detected in links";
        } else {
          const sortedIndexes = [...indexes].sort((a, b) => a - b);
          for (let i = 0; i < expectedCount; i++) {
            if (sortedIndexes[i] !== i) {
              errorMsg = `non-sequential recipientIndex detected: expected ${i}, found ${sortedIndexes[i]}`;
              break;
            }
          }
        }
        if (!errorMsg) {
          for (const link of links) {
            const index = link.recipientIndex;
            const urlStr = link.revealUrl || '';
            if (!urlStr.includes(`?r=${index}`) && !urlStr.includes(`&r=${index}`)) {
              errorMsg = `revealUrl for index ${index} does not contain '?r=${index}' or '&r=${index}' query parameter`;
              break;
            }
            if (urlStr.includes("jigzo.biz") && !urlStr.includes("staging.jigzo.biz")) {
              errorMsg = `revealUrl links to Production instead of Staging: ${urlStr}`;
              break;
            }
          }
        }
      }

      if (errorMsg) {
        alert(`Safe Staging Error: API validation failed. ${errorMsg}`);
        setIsProcessing(false);
        return;
      }

      setTestModeResult(res);
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Failed to create test reveal: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNotifyMe = async () => {
    if (!interestEmail.trim()) return;
    setInterestRegistering(true);
    try {
      await api.registerLaunchInterest(
        interestEmail,
        undefined,
        'jigzo_launch',
        window.location.href,
        { name: primaryRecipientName, difficulty: pieceCount },
        analytics.getAnonymousId(),
        analytics.getSessionId()
      );
      setInterestRegistered(true);
      analytics.track('waitlist_joined', { email: interestEmail, interestType: 'jigzo_launch' });
    } catch (err) {
      console.error(err);
      alert('Failed to register interest: ' + (err.response?.data?.error || err.message));
    } finally {
      setInterestRegistering(false);
    }
  };

  const handleSimulateSolve = () => {
    setRevealSimLoading(true);
    setRevealSimSolved(true);
    setTimeout(() => {
      setRevealSimLoading(false);
    }, 3000);
  };

  // View state navigation handlers
  const handleStep1Continue = () => {
    if (cropData) {
      setCurrentStep(2);
    }
  };

  const handleStep2Continue = () => {
    if (primaryRecipientName.trim() && message.trim()) {
      analytics.track('occasion_selected', { occasion, tone });
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
    let title = t('demo.loaderText');
    let subtitle = isAr ? 'يستغرق هذا عادةً بضع ثوانٍ فقط.' : 'This usually takes only a few seconds.';

    if (processingContext === 'payment') {
      title = isAr ? 'جارٍ فتح صفحة الدفع الآمنة' : 'Opening secure checkout';
      subtitle = currency === 'BHD'
        ? t('create.review.bhdProcessingBhdOnly')
        : t('create.review.bhdProcessingMulticurrency');
    } else if (processingContext === 'test') {
      title = isAr ? 'جارٍ إعداد أحجية الاختبار' : 'Preparing your test puzzle';
      subtitle = isAr ? 'يستغرق ذلك عادةً بضع ثوانٍ فقط.' : 'This usually takes only a few seconds.';
    }

    return (
      <div className="create-page">
        <div style={{ fontFamily: "Archia, sans-serif", color: T.ink, padding: "34px 20px 70px" }}>
          <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 50 }}>
            <LoaderOrbit />
            <h1 style={{ fontSize: 22, fontWeight: 500, margin: "24px 0 8px", letterSpacing: "-0.01em" }}>{title}</h1>
            <p style={{ fontSize: 14, color: T.ink60 }}>{subtitle}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess && testModeResult) {
    const hasMultipleLinks = testModeResult.recipientLinks && testModeResult.recipientLinks.length > 1;
    const stagingSub = isAr
      ? `هذه نسخة تجريبية للاختبار فقط. ${hasMultipleLinks ? "انسخ روابط المستلمين أدناه لاختبار عرض كل مستلم." : "انسخ الرابط أدناه للاختبار على متصفح أو جهاز آخر."}`
      : `This is a staging-only test reveal. ${hasMultipleLinks ? "Copy the recipient links below to test each recipient's view." : "Copy the link below to test on another browser or device."}`;

    return (
      <div className="create-page">
        <div style={{ fontFamily: "Archia, sans-serif", color: T.ink, padding: "34px 20px 70px" }}>
          <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 30 }}>
            <div style={{ width: 84, height: 84, margin: "0 auto 24px", borderRadius: "50%", background: T.goldWarm,
              display: "flex", alignItems: "center", justifyContent: "center", animation: "ckPop 0.5s cubic-bezier(.2,.8,.2,1) both" }}>
              <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
                <path d="M11 22 L18 29 L31 14" stroke={T.ink} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="40" strokeDashoffset="40" style={{ animation: "ckDraw 0.5s ease 0.35s forwards" }} />
              </svg>
            </div>
            <h1 style={{ fontSize: 27, fontWeight: 300, margin: "0 0 12px", letterSpacing: "-0.02em" }}>{isAr ? "تم إنشاء اختبار الكشف" : "Test Reveal Created"}</h1>
            <p style={{ fontSize: 14.5, color: T.ink66, margin: "0 auto 26px", maxWidth: 360, lineHeight: 1.6 }}>
              {stagingSub}
            </p>

            <div style={{ marginBottom: 24, textAlign: 'left' }}>
              {testModeResult.recipientLinks && testModeResult.recipientLinks.length > 0 ? (
                testModeResult.recipientLinks.map((link) => (
                  <div key={link.recipientIndex} style={{ marginBottom: 16, border: `1px solid ${T.ink15}`, padding: 16, borderRadius: 12, background: T.card }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8, color: T.ink, display: 'flex', justifyContent: 'space-between', flexDirection: isAr ? 'row-reverse' : 'row' }}>
                      <span>{isAr ? `المستلم ${link.recipientIndex + 1}` : `Recipient ${link.recipientIndex + 1}`}</span>
                      <span style={{ color: T.ink66 }}>{link.recipientName}</span>
                    </div>
                    <input type="text" readOnly value={link.revealUrl} style={{ ...inputStyle, textAlign: 'left', marginBottom: 10, fontSize: 13 }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <GhostButton onClick={() => {
                        navigator.clipboard.writeText(link.revealUrl);
                        alert(isAr ? `تم نسخ الرابط لـ ${link.recipientName}!` : `Copied link for ${link.recipientName}!`);
                      }} style={{ flex: 1, padding: "8px 12px", fontSize: 13 }}>{isAr ? "نسخ الرابط" : "Copy Link"}</GhostButton>
                      <PrimaryButton onClick={() => window.open(link.revealUrl, "_blank")} style={{ flex: 1, padding: "8px 12px", fontSize: 13 }}>{isAr ? "افتح الكشف" : "Open Reveal"}</PrimaryButton>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ border: `1px solid ${T.ink15}`, padding: 16, borderRadius: 12, background: T.card }}>
                  <input type="text" readOnly value={testModeResult.revealUrl} style={{ ...inputStyle, textAlign: 'center', marginBottom: 12 }} />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <GhostButton onClick={() => {
                      navigator.clipboard.writeText(testModeResult.revealUrl);
                      alert(isAr ? 'تم النسخ إلى الحافظة!' : 'Copied to clipboard!');
                    }} style={{ flex: 1 }}>{isAr ? "نسخ الرابط" : "Copy Link"}</GhostButton>
                    <PrimaryButton onClick={() => window.open(testModeResult.revealUrl, "_blank")} style={{ flex: 1 }}>{isAr ? "افتح الكشف" : "Open Reveal"}</PrimaryButton>
                  </div>
                </div>
              )}
            </div>


            <p style={{ fontSize: 11.5, color: T.ink50, lineHeight: 1.5 }}>
              {isAr ? "ستنتهي صلاحية هذا الاختبار خلال 7 أيام." : "This test reveal will expire in 7 days."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    const displayRecipientsText = isAr
      ? (recipients.length === 1
          ? `سيتلقى ${recipients[0].name || "المستلم"} رسالة واتساب من JIGZO مع أحجية لحلها. سيتم الكشف عن رسالتك مع القطعة الأخيرة.`
          : "سيتلقى المستلمون رسالة واتساب من JIGZO مع أحجية لحلها. سيتم الكشف عن رسالتك مع القطعة الأخيرة.")
      : (recipients.length === 1
          ? `${recipients[0].name || "They"} will receive a WhatsApp from JIGZO with a puzzle to solve. Your message unlocks with the final piece.`
          : "Your recipients will receive a WhatsApp from JIGZO with a puzzle to solve. Your message unlocks with the final piece.");

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
            <h1 style={{ fontSize: 27, fontWeight: 300, margin: "0 0 12px", letterSpacing: "-0.02em" }}>{isAr ? "تم إرسال أحجية JIGZO الخاصة بك." : "Your JIGZO has been delivered."}</h1>
            <p style={{ fontSize: 14.5, color: T.ink66, margin: "0 auto 26px", maxWidth: 360, lineHeight: 1.6 }}>
              {displayRecipientsText}
            </p>
            {testLink && (
              <PrimaryButton onClick={() => window.open(testLink, "_blank")} style={{ width: "100%" }}>
                {isAr ? "افتح الرابط (اختبار محلي)" : "Open the reveal link (local test)"}
              </PrimaryButton>
            )}
            <p style={{ fontSize: 11.5, color: T.ink50, marginTop: 12, lineHeight: 1.5 }}>
              {isAr ? "محاكاة تجريبية - لم نقم بمعالجة دفعة حقيقية أو إرسال رسالة واتساب حقيقية. انقر أعلاه لاختبار تدفق الحل محليًا." : "Prototype simulation — did not process a real payment or send a real WhatsApp. Click above to test the solve flow locally."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-page">
      {/* ===================== NAV ===================== */}
      <header className="nav" style={{ marginBottom: 20 }}>
        <div className="nav__inner">
          <Link to="/" aria-label={t('landing.nav.home')}>
            <img className="nav__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
          </Link>
          <Link to="/" aria-label={t('common.home')} style={{
            background: T.ink,
            color: T.bg,
            border: "none",
            borderRadius: 999,
            padding: "8px 18px",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            fontFamily: "Archia, sans-serif"
          }}>
            {t('common.home')}
          </Link>
        </div>
      </header>

      <div style={{ fontFamily: "Archia, sans-serif", color: T.ink, padding: "0 20px 70px" }}>
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
            <h1 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 8px", letterSpacing: "-0.02em" }}>{t('create.title')}</h1>
            <p style={{ fontSize: 14.5, color: T.ink66, margin: "0 0 20px", lineHeight: 1.5 }}>
              {t('create.photo.description')}
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
                <div style={{ fontWeight: 600, fontSize: 15.5, marginBottom: 4 }}>{t('create.photo.title')}</div>
                <div style={{ fontSize: 12.5, color: T.ink50 }}>{t('create.photo.subtitle')}</div>
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
                        transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`, transformOrigin: "center",
                        userSelect: "none", pointerEvents: "none" }} />
                    {[{ top: 10, left: 10 }, { top: 10, right: 10 }, { bottom: 10, left: 10 }, { bottom: 10, right: 10 }].map((pos, i) => (
                      <div key={i} style={{ position: "absolute", width: 16, height: 16, border: "2px solid " + T.goldBright, pointerEvents: "none",
                        ...(pos.top !== undefined ? { top: pos.top, borderBottom: "none" } : { bottom: pos.bottom, borderTop: "none" }),
                        ...(pos.left !== undefined ? { left: pos.left, borderRight: "none" } : { right: pos.right, borderLeft: "none" }) }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 10px" }}>
                  <span style={{ fontSize: 18 }}>−</span>
                  <input type="range" min="1" max="3" step="0.01" value={zoom}
                    onChange={(e) => { const z = parseFloat(e.target.value); setZoom(z); setPan((p) => clampPan(p.x, p.y, z)); }}
                    style={{ flex: 1, accentColor: T.gold }} />
                  <span style={{ fontSize: 18 }}>+</span>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}>
                  <button
                    type="button"
                    onClick={() => setRotation(r => r - 90)}
                    style={{
                      background: "transparent",
                      color: T.ink,
                      border: "1.5px solid " + T.ink15,
                      borderRadius: 999,
                      padding: "8px 16px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: "Archia, sans-serif"
                    }}
                  >
                    <span style={{ fontSize: 16 }}>↺</span> {t('create.photo.accessibility.rotateLeft')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation(r => r + 90)}
                    style={{
                      background: "transparent",
                      color: T.ink,
                      border: "1.5px solid " + T.ink15,
                      borderRadius: 999,
                      padding: "8px 16px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: "Archia, sans-serif"
                    }}
                  >
                    {t('create.photo.accessibility.rotateRight')} <span style={{ fontSize: 16 }}>↻</span>
                  </button>
                </div>
                <div className="footer-nav">
                  <GhostButton onClick={() => { setImgSrc(null); setRotation(0); }}>{t('common.cancel')}</GhostButton>
                  <PrimaryButton onClick={captureCrop} style={{ flex: 1 }}>{t('create.photo.cropTitle')}</PrimaryButton>
                </div>
              </div>
            )}

            {cropData && (
              <div style={{ animation: "fadeUp 0.4s ease" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                  <div style={{ position: "relative", width: "100%", maxWidth: 170, aspectRatio: "9 / 16", borderRadius: 14,
                    overflow: "hidden", boxShadow: T.shadowRest, border: "1px solid " + T.ink08 }}>
                    <img src={cropData} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => { setCropData(null); setZoom(1.2); setPan({ x: 0, y: 0 }); setRotation(0); }} className="edit-btn"
                      style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)" }}>{t('create.photo.change')}</button>
                  </div>
                </div>

                {!difficultyOpen ? (
                  <div className="difficulty-summary">
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink40, marginBottom: 2 }}>{t('create.photo.difficultyLabel')}</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{t(`difficulties.${currentDifficulty.id}.label`)} · {t(`difficulties.${currentDifficulty.id}.pieces`)}</div>
                    </div>
                    <button type="button" onClick={() => setDifficultyOpen(true)} className="btn-change">{t('create.photo.change')}</button>
                  </div>
                ) : (
                  <div style={{ padding: 18, borderRadius: 16, background: T.card, border: "1px solid " + T.ink08, marginBottom: 18, animation: "fadeUp 0.3s ease" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink40, marginBottom: 10 }}>{t('create.photo.selectDifficulty')}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {PIECE_OPTIONS.map((opt) => {
                        const isSel = opt.count === pieceCount;
                        return (
                          <button type="button" key={opt.count} onClick={() => { setPieceCount(opt.count); setDifficultyOpen(false); }} className={`difficulty-option ${isSel ? "active" : ""}`}
                            style={{ display: "block", width: "100%", padding: "14px 16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>{t(`difficulties.${opt.id}.label`)}</span>
                                {opt.recommended && (
                                  <span style={{ fontSize: 10.5, fontWeight: 700, background: T.goldWarm, color: T.ink, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>
                                    ★ {t('create.photo.recommended')}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 11.5, fontWeight: 500, color: isSel ? T.bg : T.ink50, background: isSel ? T.ink : "rgba(28,25,19,0.06)", padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>{t(`difficulties.${opt.id}.pieces`)}</span>
                            </div>
                            <div style={{ fontSize: 12.5, color: isSel ? T.ink74 : T.ink66, textAlign: "left", lineHeight: 1.4 }}>{t(`difficulties.${opt.id}.copy`)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="footer-nav" style={{ marginTop: 24 }}>
                  <PrimaryButton onClick={handleStep1Continue} style={{ flex: 1 }}>{t('common.continue')}</PrimaryButton>
                </div>
              </div>
            )}

            <input type="file" ref={fileInputRef} onChange={(e) => handleFile(e.target.files[0])} accept="image/*" style={{ display: "none" }} />
          </div>
        )}

        {/* ============ STEP 2 — PERSONALIZE ============ */}
        {currentStep === 2 && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 8px", letterSpacing: "-0.02em" }}>{t('create.recipient.title')}</h1>
            <p style={{ fontSize: 14.5, color: T.ink66, margin: "0 0 20px", lineHeight: 1.5 }}>
              {t('create.recipient.subtitle')}
            </p>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink50, marginBottom: 6 }}>{t('create.recipient.recipientLabel')}</label>
              <input type="text" placeholder={t('create.recipient.recipientPlaceholder')} value={primaryRecipientName}
                onChange={(e) => handlePrimaryRecipientNameChange(e.target.value)} style={inputStyle}
                autoComplete="off" />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink50, marginBottom: 8 }}>{t('create.recipient.occasionLabel')}</label>
              <div className={`occasions-chips-wrapper ${occasion ? "chips-container-has-selection" : ""}`} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {OCCASIONS.map((o) => (
                  <button type="button" key={o.id} onClick={() => { setOccasion(o.id); pickCombo(o.id, tone); }}
                    className={`occasion-chip ${o.id === occasion ? "active" : ""}`}>{t(`occasions.${o.id}`)}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 18, animation: "fadeUp 0.3s ease" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink50, marginBottom: 8 }}>{t('create.recipient.toneLabel')}</label>
              <div className={`tones-chips-wrapper ${tone ? "chips-container-has-selection" : ""}`} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TONES.map((tOpt) => (
                  <button type="button" key={tOpt.id} onClick={() => { setTone(tOpt.id); pickCombo(occasion, tOpt.id); }}
                    className={`tone-chip ${tOpt.id === tone ? "active" : ""}`}>{t(`tones.${tOpt.id}`)}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink50 }}>{t('create.recipient.messageLabel')}</label>
                {occasion && tone && suggestedMessage(occasion, tone) && (
                  <button type="button" onClick={useSuggested} className="btn-change">{t('create.recipient.suggestedInsert')}</button>
                )}
              </div>
              <textarea placeholder={t('create.recipient.messagePlaceholder')} value={message} onChange={(e) => setMessage(e.target.value)}
                style={{ ...inputStyle, resize: "none", height: 110, lineHeight: 1.5, padding: 14 }} />
            </div>

            <div className="footer-nav">
              <GhostButton onClick={handleBack}>{t('common.back')}</GhostButton>
              <PrimaryButton onClick={handleStep2Continue} disabled={!primaryRecipientName.trim() || !message.trim()} style={{ flex: 1 }}>{t('common.continue')}</PrimaryButton>
            </div>
          </div>
        )}

        {/* ============ STEP 3 — SEND ============ */}
        {currentStep === 3 && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 8px", letterSpacing: "-0.02em" }}>{t('create.delivery.title')}</h1>
            <p style={{ fontSize: 14.5, color: T.ink66, margin: "0 0 20px", lineHeight: 1.5 }}>
              {t('create.delivery.subtitle')}
            </p>

            <div onClick={() => setPackageAccordionOpen(!packageAccordionOpen)} role="button" aria-expanded={packageAccordionOpen}
              style={{ padding: 18, borderRadius: 16, background: T.card, border: "1.5px solid " + T.ink15, marginBottom: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink40, marginBottom: 2 }}>{t('create.delivery.currentPackage')}</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{t(`packages.${currentPack.id}.label`)} · {currentPack.limit === 1 ? t('create.delivery.recipientLimit_one') : t('create.delivery.recipientLimit_other', { count: currentPack.limit })} · {formatPrice(currentPack.price)}</div>
              </div>
              <span style={{ fontSize: 12 }}>{packageAccordionOpen ? "▲" : "▼"}</span>
            </div>

            {packageAccordionOpen && (
              <div style={{ padding: 16, borderRadius: 16, background: T.card, border: "1px solid " + T.ink08, marginBottom: 16, animation: "fadeUp 0.3s ease" }}>
                <div style={{ fontSize: 12, color: T.ink50, marginBottom: 12, lineHeight: 1.4 }}>
                  {t('create.delivery.autoPlanSelection')}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink40, marginBottom: 10 }}>{t('create.delivery.availablePlans')}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {PACK_OPTIONS.map((pack) => {
                    const isSel = pack.id === currentPack.id;
                    return (
                      <div key={pack.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 10, border: isSel ? "1.5px solid " + T.ink : "1px solid " + T.ink08, background: isSel ? "rgba(28,25,19,0.02)" : "transparent" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14.5, display: "flex", alignItems: "center", gap: 6 }}>
                            <span>{t(`packages.${pack.id}.label`)}</span>
                            {isSel && (
                              <span style={{ fontSize: 10.5, fontWeight: 700, background: T.goldWarm, color: T.ink, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap", display: "inline-block" }}>
                                {t('packages.active')}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: T.ink66, marginTop: 4 }}>{pack.limit === 1 ? t('create.delivery.recipientLimit_one') : t('create.delivery.recipientLimit_other', { count: pack.limit })}</div>
                        </div>
                        <span style={{ fontFamily: T.mono, fontWeight: 600, fontSize: 15, color: T.ink }}>{formatPrice(pack.price)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recipient Details List */}
            {recipients.map((rec, idx) => {
              const method = rec.deliveryMethod === "email" ? "email" : "whatsapp";
              const recValid = phoneValid(rec.dial, rec.phone);
              const fullPhone = rec.dial + rec.phone;
              const isDuplicatePhone = rec.phone && recipients.some((r, i) => i !== idx && (r.deliveryMethod !== "email") && (r.dial + r.phone) === fullPhone);
              const normalizedEmail = String(rec.email || "").trim().toLowerCase();
              const recEmailValid = emailValid(rec.email);
              const isDuplicateEmail = normalizedEmail && recipients.some((r, i) => i !== idx && r.deliveryMethod === "email" && String(r.email || "").trim().toLowerCase() === normalizedEmail);
              return (
                <div key={idx} style={{ padding: 18, borderRadius: 16, background: T.card, border: "1px solid " + T.ink08, marginBottom: 16, position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontWeight: 600, fontSize: 14.5 }}>{t('create.delivery.recipientTitle', { index: idx + 1 })}</span>
                    {recipients.length > 1 && (
                      <button type="button" onClick={() => setRecipients(prev => prev.filter((_, i) => i !== idx))} className="edit-btn">{t('create.delivery.remove')}</button>
                    )}
                  </div>
                  <input type="text" placeholder={t('create.delivery.recipientPlaceholder')} value={rec.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (idx === 0) setPrimaryRecipientName(val);
                      setRecipients(prev => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], name: val };
                        return next;
                      });
                    }}
                    style={{ ...inputStyle, marginBottom: 14 }}
                    autoComplete="off"
                  />

                  {/* Delivery method */}
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.ink50, marginBottom: 6 }}>{t('create.delivery.deliverVia')}</label>
                  <select
                    value={method}
                    onChange={(e) => {
                      const val = e.target.value === "email" ? "email" : "whatsapp";
                      setRecipients(prev => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], deliveryMethod: val };
                        return next;
                      });
                    }}
                    style={{ ...inputStyle, marginBottom: 14 }}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                  </select>

                  {method === "email" ? (
                    <>
                      <input
                        type="email"
                        placeholder={t('create.delivery.emailPlaceholder')}
                        value={rec.email}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRecipients(prev => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], email: val };
                            return next;
                          });
                        }}
                        aria-invalid={rec.email && !recEmailValid ? "true" : "false"}
                        inputMode="email"
                        autoComplete="off"
                        style={{ ...inputStyle }}
                      />
                      {rec.email && (!recEmailValid || isDuplicateEmail) && (
                        <div style={{ marginTop: 8, fontSize: 12.5, color: T.goldDeep, fontWeight: 500, textAlign: "left", display: "flex", alignItems: "center", gap: 4 }}>
                          <span>⚠️</span>
                          <span>
                            {!recEmailValid
                              ? t('create.delivery.emailInvalid')
                              : t('create.delivery.emailDuplicate')
                            }
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 10 }}>
                        <input
                          type="text"
                          value={rec.dial}
                          onChange={(e) => {
                            const val = sanitizeDialCode(e.target.value);
                            setRecipients(prev => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], dial: val, dialEdited: true };
                              return next;
                            });
                          }}
                          dir="ltr"
                          inputMode="tel"
                          style={{ ...inputStyle, width: "80px", flex: "none", padding: "13px 8px", textAlign: "center" }}
                          placeholder="+973"
                        />
                        <input type="tel" placeholder={t('create.delivery.phonePlaceholder')} value={rec.phone}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRecipients(prev => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], phone: val };
                              return next;
                            });
                          }}
                          aria-invalid={rec.phone && !recValid ? "true" : "false"}
                          dir="ltr"
                          inputMode="tel"
                          autoComplete="off"
                          style={{ ...inputStyle, flex: 1, textAlign: "left" }}
                        />
                      </div>

                      {rec.phone && (!recValid || isDuplicatePhone) && (
                        <div style={{ marginTop: 8, fontSize: 12.5, color: T.goldDeep, fontWeight: 500, textAlign: "left", display: "flex", alignItems: "center", gap: 4 }}>
                          <span>⚠️</span>
                          <span>
                            {!recValid
                              ? t('create.delivery.phoneInvalid')
                              : t('create.delivery.phoneDuplicate')
                            }
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {recipients.length < 50 && (
              <button
                type="button"
                onClick={() => {
                  const nextRecipients = [...recipients, { name: "", phone: "", dial: defaultDialCode, dialEdited: false, deliveryMethod: "whatsapp", email: "" }];
                  setRecipients(nextRecipients);
                  analytics.track('recipient_added', {
                    recipientCount: nextRecipients.length,
                    recipients: nextRecipients.map(r => ({ name: r.name, country: getCountryCodeFromDial(r.dial) }))
                  });
                }}
                className="add-recipient-btn"
              >
                + {t('create.delivery.addRecipient')}
              </button>
            )}

            {/* Sender Details */}
            <div style={{ padding: 18, borderRadius: 16, background: T.card, border: "1px solid " + T.ink08, margin: "16px 0" }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 12 }}>{t('create.delivery.senderDetailsTitle')}</div>
              <input type="text" placeholder={t('create.delivery.senderNamePlaceholder')} value={senderName} onChange={(e) => setSenderName(e.target.value)}
                style={{ ...inputStyle, marginBottom: 14 }}
                autoComplete="name" />
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  value={senderDial}
                  onChange={(e) => {
                    const val = sanitizeDialCode(e.target.value);
                    setSenderDial(val);
                    senderDialEditedRef.current = true;
                  }}
                  dir="ltr"
                  inputMode="tel"
                  style={{ ...inputStyle, width: "80px", flex: "none", padding: "13px 8px", textAlign: "center" }}
                  placeholder="+973"
                />
                <input type="tel" placeholder={t('create.delivery.senderPhonePlaceholder')} value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)}
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  style={{ ...inputStyle, flex: 1, textAlign: "left" }} />
              </div>

              {senderPhone && !senderValid && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: T.goldDeep, fontWeight: 500, textAlign: "left", display: "flex", alignItems: "center", gap: 4 }}>
                  <span>⚠️</span>
                  <span>{t('create.delivery.phoneInvalid')}</span>
                </div>
              )}
              {senderPhone && senderValid && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: T.ink50, fontWeight: 500, textAlign: "left" }}>
                  {t('create.delivery.phoneFormatValid')}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14 }}>
                <input type="checkbox" id="show-identity" checked={revealIdentity} onChange={(e) => setRevealIdentity(e.target.checked)} style={{ marginTop: 4, flex: "none" }} />
                <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                  <label htmlFor="show-identity" style={{ fontWeight: 600, cursor: "pointer" }}>{t('create.delivery.revealIdentityLabel')}</label>
                  <p style={{ fontSize: 12.5, color: T.ink50, margin: "6px 0 0", lineHeight: 1.4 }}>
                    {t('create.delivery.revealIdentityHint')}
                  </p>
                </div>
              </div>
            </div>

            <Disclosure title={t('create.delivery.previewTitle')} defaultOpen={true}>
              <WhatsAppPreview senderName={senderName} showIdentity={revealIdentity} receiverName={recipients[0]?.name} />
            </Disclosure>

            <div className="footer-nav">
              <GhostButton onClick={handleBack}>{t('common.back')}</GhostButton>
              <PrimaryButton onClick={handleStep3Continue} disabled={!step3Ready} style={{ flex: 1 }}>{t('common.continue')}</PrimaryButton>
            </div>
          </div>
        )}

        {/* ============ STEP 4 — REVIEW & PAY ============ */}
        {currentStep === 4 && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h1 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 8px", letterSpacing: "-0.02em" }}>{t('create.review.title')}</h1>
            <p style={{ fontSize: 14.5, color: T.ink66, margin: "0 0 20px", lineHeight: 1.5 }}>
              {t('create.review.subtitle')}
            </p>

            <div style={{ padding: 18, borderRadius: 16, background: T.card, border: "1px solid " + T.ink08, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
                {cropData && (
                  <div style={{ position: "relative", flex: "none" }}>
                    <img src={cropData} alt="" style={{ width: 52, height: 92, objectFit: "cover", borderRadius: 8 }} />
                    <button type="button" onClick={() => setCurrentStep(1)} className="edit-btn" style={{ display: "block", marginTop: 4, textAlign: "center", width: "100%" }}>{t('create.review.edit')}</button>
                  </div>
                )}
                <div style={{ fontSize: 13.5, lineHeight: 1.7, flex: 1 }}>
                  <div><strong>{t('create.review.recipientsLabel')} ({recipients.length})</strong> · {recipients.map(r => r.name || "—").join(", ")} <button type="button" onClick={() => setCurrentStep(3)} className="edit-btn">{t('create.review.edit')}</button></div>
                  <div style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 260 }}>
                    <strong>{t('create.review.messageLabel')}</strong> · "{message}" <button type="button" onClick={() => setCurrentStep(2)} className="edit-btn">{t('create.review.edit')}</button>
                  </div>
                  <div><strong>{t('create.review.difficultyLabel')}</strong> · {t(`difficulties.${currentDifficulty.id}.label`)} ({t('create.photo.pieceCount', { count: pieceCount }) || `${pieceCount} pieces`}) <button type="button" onClick={() => setCurrentStep(1)} className="edit-btn">{t('create.review.edit')}</button></div>
                  <div><strong>{t('create.review.senderLabel')}</strong> · {revealIdentity ? t('create.review.senderYes', { name: senderName }) : t('create.review.senderNo')} <button type="button" onClick={() => setCurrentStep(3)} className="edit-btn">{t('create.review.edit')}</button></div>
                </div>
              </div>
            </div>

            <Disclosure title={t('create.review.previewTitle')} defaultOpen={true}>
              <div style={{ display: "flex", justifyContent: "center", margin: "14px 0" }}>
                <div
                  onClick={() => { if (!revealSimSolved) handleSimulateSolve(); }}
                  style={{ position: "relative", width: 170, aspectRatio: "9 / 16", borderRadius: 20,
                    boxShadow: "0 4px 18px rgba(0,0,0,0.18), 0 0 0 3px #050505", overflow: "hidden", cursor: revealSimSolved ? "default" : "pointer" }}>

                  {!revealSimSolved ? (
                    <div style={{ position: "absolute", inset: 0, background: "#FAF8EC", overflow: "hidden" }}>
                      {/* Blank board target guide lines inside */}
                      <div style={{ position: "absolute", inset: 8, border: "1.5px dashed rgba(28,25,19,0.12)", borderRadius: 10 }} />

                      {/* Scrambled pieces scattered on top of the blank board */}
                      {previewPieces.map((p, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: "absolute",
                            left: `${p.posX - p.tabPad}px`,
                            top: `${p.posY - p.tabPad}px`,
                            width: `${p.elemW}px`,
                            height: `${p.elemH}px`,
                            transform: `rotate(${p.angle}deg)`,
                            pointerEvents: "none",
                            zIndex: 10 + idx
                          }}
                        >
                          <svg viewBox={`${-p.tabPad} ${-p.tabPad} ${p.elemW} ${p.elemH}`} width={p.elemW} height={p.elemH} style={{ display: "block", overflow: "visible" }}>
                            <defs>
                              <clipPath id={`preview-clip-${idx}`}>
                                <path d={p.d} />
                              </clipPath>
                            </defs>
                            <g clipPath={`url(#preview-clip-${idx})`}>
                              <image
                                href={cropData}
                                x={-p.c * p.pw}
                                y={-p.r * p.ph}
                                width={170}
                                height={302}
                                preserveAspectRatio="xMidYMid slice"
                              />
                            </g>
                            <path d={p.d} stroke="rgba(28,25,19,0.32)" strokeWidth="1.1" fill="none" />
                          </svg>
                        </div>
                      ))}

                      {/* Text indicator */}
                      <div style={{
                        position: "absolute",
                        bottom: "15%",
                        left: 0,
                        right: 0,
                        textAlign: "center",
                        fontFamily: "Caveat, cursive",
                        fontSize: "20px",
                        fontWeight: "700",
                        color: "#FAF8EC",
                        background: "rgba(28, 25, 19, 0.78)",
                        padding: "6px 0",
                        backdropFilter: "blur(2px)",
                        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                        zIndex: 100,
                        pointerEvents: "none",
                        lineHeight: "1.2"
                      }}>
                        {t('create.review.tapToSolve')}
                      </div>
                    </div>
                  ) : (
                    <div style={{ position: "absolute", inset: 0, animation: "fadeUp 0.5s ease" }}>
                      <RevealFace photo={cropData} toName={recipients[0]?.name} fromName={senderName} message={message} />
                    </div>
                  )}

                  {/* Standard loader overlay */}
                  {revealSimLoading && (
                    <RevealBeat w="100%" h="100%" pad={0} radius={60} />
                  )}
                </div>
              </div>
              {revealSimSolved && !revealSimLoading && (
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <button type="button" onClick={() => { setRevealSimSolved(false); setRevealSimLoading(false); }} className="btn-change" style={{ fontSize: 12.5 }}>
                    {t('create.review.resetSim')}
                  </button>
                </div>
              )}
            </Disclosure>

            {UPGRADES.map((u) => {
              const selected = selectedUpgrades.includes(u.id);
              const priceVal = getUpgradePrice(u.id);
              const addForText = isAr
                ? `أضف مقابل ${formatPrice(priceVal)}`
                : `Add for ${formatPrice(priceVal)}`;
              return (
                <div key={u.id} onClick={() => toggleUpgrade(u.id)} role="button" aria-pressed={selected}
                  style={{ border: selected ? "2px solid " + T.ink : "1.5px solid " + T.ink15,
                    background: selected ? "rgba(28,25,19,0.04)" : T.card, borderRadius: 16, padding: 18,
                    marginBottom: 16, cursor: "pointer", transition: "border-color 0.2s ease, background 0.2s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 15.5, flex: 1 }}>{t(`upgrades.${u.id}.name`)}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.ink }}>{addForText}</div>
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
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.goldDeep, marginBottom: 4 }}>{t(`upgrades.${u.id}.tagline`)}</div>
                  <div style={{ fontSize: 12.5, color: T.ink66, lineHeight: 1.4 }}>{t(`upgrades.${u.id}.description`)}</div>
                </div>
              );
            })}

            <div style={{ padding: 16, borderRadius: 14, background: T.card, border: "1px solid " + T.ink08, marginBottom: 16 }}>
              <div className="price-row">
                <span>{t(`packages.${currentPack.id}.label`)} ({t('common.recipientsCount', { count: recipients.length })})</span>
                <span>{formatPrice(BASE_PRICE)}</span>
              </div>
              {selectedUpgrades.includes("insights") && (
                <div className="price-row">
                  <span>{t('create.review.revealAlertAddon')}</span>
                  <span>+{formatPrice(getUpgradePrice("insights"))}</span>
                </div>
              )}
              <div className="price-row total">
                <span>{t('create.review.total')}</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
            </div>

            {!checkoutEnabled && (
              <div style={{ textAlign: 'center', padding: '20px', background: T.card, borderRadius: 16, border: '1.5px solid ' + T.ink15, margin: "20px 0" }}>
                <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, color: T.ink }}>{t('create.review.launchingSoon')}</h2>
                {interestRegistered ? (
                  <p style={{ fontSize: 14.5, color: T.goldDeep, fontWeight: 600, margin: "14px 0" }}>
                    {t('create.review.onTheList')}
                  </p>
                ) : (
                  <>
                    <p style={{ fontSize: 13.5, color: T.ink66, lineHeight: 1.4, marginBottom: 14 }}>
                      {t('create.review.leaveDetails')}
                    </p>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                      <input
                        type="email"
                        placeholder={t('create.review.emailPlaceholder')}
                        value={interestEmail}
                        onChange={(e) => setInterestEmail(e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                        disabled={interestRegistering}
                      />
                      <PrimaryButton
                        onClick={handleNotifyMe}
                        disabled={!interestEmail.trim() || interestRegistering}
                        style={{ flex: 'none', padding: '10px 20px' }}
                      >
                        {interestRegistering ? "..." : t('create.review.notifyMe')}
                      </PrimaryButton>
                    </div>
                  </>
                )}
                <div style={{ fontSize: 12, color: T.goldDeep, fontWeight: 600 }}>
                  {t('create.review.noPayment')}
                </div>
              </div>
            )}

            {paymentError && (
              <div style={{
                padding: 12,
                borderRadius: 12,
                background: "#fdf2f2",
                border: "1.5px solid #fbd5d5",
                color: "#9b1c1c",
                fontSize: 13.5,
                lineHeight: 1.4,
                marginBottom: 14,
                textAlign: "center"
              }}>
                {t('create.review.paymentErrorPrefix')} {paymentError}
              </div>
            )}

            {checkoutEnabled && (
              <div style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: 12,
                borderRadius: 12,
                background: '#fdfbfa',
                border: `1px solid ${T.goldWarm}40`,
                color: T.ink74,
                fontSize: 13,
                lineHeight: 1.4,
                marginBottom: 14,
                textAlign: isAr ? 'right' : 'left',
                direction: isAr ? 'rtl' : 'ltr'
              }}>
                <svg style={{ width: 16, height: 16, color: T.goldDeep, marginTop: 2, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {currency === 'BHD'
                    ? t('create.review.bhdNoticeBhdOnly')
                    : t('create.review.bhdNoticeMulticurrency')}
                </span>
              </div>
            )}

            <div className="footer-nav" style={{ flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <GhostButton onClick={handleBack}>{t('common.back')}</GhostButton>
                {checkoutEnabled ? (
                  <PrimaryButton
                    onClick={handlePayAndSend}
                    disabled={isProcessing}
                    style={{ flex: 1 }}
                  >
                    {isProcessing ? t('create.review.payment.submitting') : t('create.review.payAndSend')}
                  </PrimaryButton>
                ) : (
                  <PrimaryButton disabled style={{ flex: 1 }}>{t('create.review.payAndSend')}</PrimaryButton>
                )}
              </div>
              {isTestModeEnabled && (
                <PrimaryButton onClick={handleCreateTestReveal} style={{ width: '100%', background: T.goldWarm, color: T.ink }}>
                  {t('create.review.createTestReveal')}
                </PrimaryButton>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* ===================== FOOTER ===================== */}
      <footer className="footer" style={{ marginTop: 60 }}>
        <div className="footer__inner">
          <div className="footer__brand">
            <img className="footer__logo" src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" />
            <span className="footer__by">{t('landing.footer.by')}</span>
          </div>
          <div className="footer__tag">{t('landing.footer.tag')}</div>
          <div className="footer__links">
            <Link className="footer__link" to="/terms">{t('landing.footer.terms')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function formatPrice(num) {
  return formatMoney(num);
}
