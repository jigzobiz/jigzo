import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { buildEdgeMap, piecePath, mulberry32 } from '../puzzle/puzzle-shape';
import RevealBeat from '../components/RevealBeat';
import LoaderOrbit from '../components/LoaderOrbit';
import { analytics } from '../services/analytics';

const GRID_FOR = {
  6: { cols: 2, rows: 3 },
  15: { cols: 3, rows: 5 },
  18: { cols: 3, rows: 6 },
  28: { cols: 4, rows: 7 }
};

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

// Styling shadow tokens
const REST_SHADOW = "drop-shadow(0 2px 3px rgba(5,5,5,0.22)) drop-shadow(0 1px 1px rgba(5,5,5,0.15))";
const PICKUP_SHADOW = "drop-shadow(0 10px 18px rgba(5,5,5,0.24)) drop-shadow(0 2px 4px rgba(5,5,5,0.12))";
const SETTLE = "transform 0.28s cubic-bezier(0.25, 1, 0.2, 1), filter 0.24s ease";

export default function ReceivePage() {
  const { publicId } = useParams();
  const [searchParams] = useSearchParams();
  
  const rQueryValue = searchParams.get("r");
  const rIndexParsed = rQueryValue !== null && rQueryValue !== "" ? parseInt(rQueryValue, 10) : undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [puzzleData, setPuzzleData] = useState(null);
  const [resolvedRIndex, setResolvedRIndex] = useState(0);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const startTimeRef = useRef(null);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryTrigger(prev => prev + 1);
  };

  // Fetch puzzle details on mount
  useEffect(() => {
    if (!publicId) return;
    let active = true;

    const loadPuzzle = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getPuzzle(publicId, rIndexParsed);
        if (!active) return;
        
        const puzzle = res.puzzle;
        const finalRIndex = puzzle.recipient?.index ?? 0;
        setResolvedRIndex(finalRIndex);

        if (puzzle && puzzle.cropImageUrl && puzzle.cropImageUrl.startsWith('/uploads')) {
          // Uploads are served same-origin via the /uploads route (see vercel.json)
          // and the Vite dev proxy, so a relative URL is correct in every
          // environment. VITE_API_URL overrides only when explicitly configured.
          const apiBase = import.meta.env.VITE_API_URL || '';
          puzzle.cropImageUrl = `${apiBase}${puzzle.cropImageUrl}`;
        }
        
        // Log open event asynchronously
        api.recordOpen(publicId, finalRIndex).catch(console.error);
        analytics.track('puzzle_opened', { puzzleId: publicId, recipientIndex: finalRIndex });

        if (puzzle.cropImageUrl) {
          const img = new Image();
          
          let completed = false;
          const handleSuccess = () => {
            if (!active || completed) return;
            completed = true;
            setPuzzleData(puzzle);
            startTimeRef.current = Date.now();
            setLoading(false);
          };

          const handleFailure = (err) => {
            if (!active || completed) return;
            completed = true;
            console.error('[ReceivePage] Image loading/decoding failed:', err);
            setError('Failed to load JIGZO puzzle image.');
            setLoading(false);
          };

          img.onload = () => {
            if (!active || completed) return;
            if (typeof img.decode === 'function') {
              img.decode()
                .then(() => {
                  handleSuccess();
                })
                .catch((decodeErr) => {
                  console.warn('[ReceivePage] decode() rejected, falling back to dimensions check:', decodeErr);
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    handleSuccess();
                  } else {
                    handleFailure(decodeErr);
                  }
                });
            } else {
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                handleSuccess();
              } else {
                handleFailure(new Error('Invalid image dimensions'));
              }
            }
          };

          img.onerror = (err) => {
            handleFailure(err);
          };

          img.src = puzzle.cropImageUrl;

          // Handle cached images
          if (img.complete) {
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              if (typeof img.decode === 'function') {
                img.decode()
                  .then(() => {
                    handleSuccess();
                  })
                  .catch((decodeErr) => {
                    console.warn('[ReceivePage] Cached image decode() rejected, continuing:', decodeErr);
                    handleSuccess();
                  });
              } else {
                handleSuccess();
              }
            }
          }
        } else {
          setPuzzleData(puzzle);
          startTimeRef.current = Date.now();
          setLoading(false);
        }
      } catch (err) {
        if (!active) return;
        console.error(err);
        setError(err.response?.data?.error || err.message || 'Failed to load JIGZO puzzle.');
        setLoading(false);
      }
    };
    loadPuzzle();

    return () => {
      active = false;
    };
  }, [publicId, rIndexParsed, retryTrigger]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF8EC" }}>
        <LoaderOrbit />
      </div>
    );
  }

  if (error || !puzzleData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Archia, sans-serif", padding: 24, background: "#FAF8EC" }}>
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 22, color: "#7a1c1c", marginBottom: 10 }}>Couldn’t load JIGZO</div>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(5,5,5,0.6)", margin: "0 0 22px" }}>
            {error || 'The puzzle link might be expired or invalid.'}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button type="button" onClick={handleRetry} style={{ display: "inline-block", background: "#050505", color: "#FAF8EC", border: "none",
              fontWeight: 600, fontSize: 14, borderRadius: 999, padding: "13px 26px", cursor: "pointer" }}>Retry</button>
            <a href="/" style={{ display: "inline-block", background: "transparent", color: "#050505", border: "1.5px solid #050505", textDecoration: "none",
              fontWeight: 600, fontSize: 14, borderRadius: 999, padding: "12px 26px" }}>Go Home</a>
          </div>
        </div>
      </div>
    );
  }

  return <Receiver data={puzzleData} setData={setPuzzleData} publicId={publicId} rIndex={resolvedRIndex} startTimeRef={startTimeRef} />;
}

function Receiver({ data, setData, publicId, rIndex, startTimeRef }) {
  const g = GRID_FOR[data.pieceCount] || { cols: 3, rows: 6 };
  const cols = g.cols, rows = g.rows;
  const BW = 288, BH = 512, PAD = 46;
  const stageW = BW + PAD * 2, stageH = BH + PAD * 2;
  const pieceW = BW / cols, pieceH = BH / rows;
  const tabPad = 0.46 * Math.max(pieceW, pieceH);
  const bound = Math.min(tabPad, PAD);
  const elemW = pieceW + tabPad * 2, elemH = pieceH + tabPad * 2;
  const SNAP = Math.max(20, Math.min(pieceW, pieceH) * 0.36);
  const edgeMap = useMemo(() => buildEdgeMap(cols, rows, 1337), [cols, rows]);

  const homes = useMemo(() => {
    const arr = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        arr.push({ r, c, hx: PAD + c * pieceW, hy: PAD + r * pieceH });
      }
    }
    return arr;
  }, [cols, rows, pieceW, pieceH]);

  const scatter = useCallback(() => {
    const rand = mulberry32(4242 + (cols * 31 + rows) * 77);
    const minX = bound, maxX = stageW - pieceW - bound;
    const minY = bound, maxY = stageH - pieceH - bound;
    return homes.map((h) => {
      let x, y, tries = 0;
      do {
        x = minX + rand() * (maxX - minX);
        y = minY + rand() * (maxY - minY);
        tries++;
      } while (tries < 8 && Math.hypot(x - h.hx, y - h.hy) < SNAP * 2);
      return { x, y, rot: (rand() - 0.5) * 2 * 9 };
    });
  }, [homes, cols, rows, bound, stageW, stageH, pieceW, pieceH, SNAP]);

  const [positions, setPositions] = useState(scatter);
  const [placed, setPlaced] = useState(() => homes.map(() => false));
  const [gid, setGid] = useState(() => homes.map((_, i) => i));
  const [showReveal, setShowReveal] = useState(false);
  const [loaderRunning, setLoaderRunning] = useState(false);

  useEffect(() => {
    if (showReveal) {
      setLoaderRunning(true);
      
      // Calculate and report solve duration
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        api.recordComplete(publicId, rIndex, elapsed)
          .then((res) => {
            if (res && res.success) {
              setData(prev => ({
                ...prev,
                message: res.message,
                completedAt: res.completedAt,
                completionRecorded: res.completionRecorded,
                recipient: prev.recipient ? {
                  ...prev.recipient,
                  completedAt: res.completedAt
                } : undefined
              }));
            }
          })
          .catch(err => {
            console.error('[ReceivePage] Completion recording failed:', err);
            alert('Failed to register solve. Message may not unlock correctly.');
          });
        analytics.track('puzzle_completed', { puzzleId: publicId, recipientIndex: rIndex, durationSeconds: elapsed });
      }

      const t = setTimeout(() => setLoaderRunning(false), 3000);
      return () => clearTimeout(t);
    } else {
      setLoaderRunning(false);
    }
  }, [showReveal, publicId, rIndex, startTimeRef]);

  const currentStageH = showReveal ? (stageW * 16 / 9) : stageH;

  const [scale, setScale] = useState(1);
  const wrapRef = useRef(null), stageRef = useRef(null), cardRef = useRef(null);
  const pieceRefs = useRef([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fit = () => {
      const availW = wrap.clientWidth;
      const offsetHeight = showReveal ? 240 : 130;
      const availH = Math.max(240, window.innerHeight - offsetHeight);
      
      const scaleW = availW / stageW;
      const scaleH = availH / currentStageH;
      setScale(Math.min(1, scaleW, scaleH));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [stageW, stageH, showReveal]);

  const gridNeighbors = (i) => {
    const h = homes[i], res = [];
    if (h.c > 0) res.push(i - 1);
    if (h.c < cols - 1) res.push(i + 1);
    if (h.r > 0) res.push(i - cols);
    if (h.r < rows - 1) res.push(i + cols);
    return res;
  };

  const onDown = (i, e) => {
    if (placed[i] || showReveal) return;
    e.preventDefault();
    const myGid = gid[i];
    const members = [];
    for (let k = 0; k < gid.length; k++) if (gid[k] === myGid) members.push(k);
    if (!pieceRefs.current[i]) return;

    const rect0 = stageRef.current.getBoundingClientRect();
    const sc = rect0.width / stageW || 1;
    const toLoc = (cx, cy) => ({ x: (cx - rect0.left) / sc, y: (cy - rect0.top) / sc });

    const orig = {};
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    members.forEach((m) => {
      orig[m] = { x: positions[m].x, y: positions[m].y };
      minX = Math.min(minX, orig[m].x); maxX = Math.max(maxX, orig[m].x);
      minY = Math.min(minY, orig[m].y); maxY = Math.max(maxY, orig[m].y);
    });
    const dxMin = bound - minX, dxMax = (stageW - pieceW - bound) - maxX;
    const dyMin = bound - minY, dyMax = (stageH - pieceH - bound) - maxY;
    const clampDelta = (dx, dy) => ({ x: clamp(dx, dxMin, dxMax), y: clamp(dy, dyMin, dyMax) });

    const start = toLoc(e.clientX, e.clientY);
    const grabx = start.x - orig[i].x, graby = start.y - orig[i].y;
    let pointer = { x: e.clientX, y: e.clientY };
    let raf = 0;

    const drawAt = (dx, dy) => {
      members.forEach((m) => {
        const n = pieceRefs.current[m]; if (!n) return;
        n.style.transform = `translate3d(${orig[m].x + dx - tabPad}px, ${orig[m].y + dy - tabPad}px, 0) scale(1.05)`;
      });
    };
    members.forEach((m) => {
      const n = pieceRefs.current[m]; if (!n) return;
      n.style.transition = "none"; n.style.willChange = "transform"; n.style.zIndex = "50";
      n.style.cursor = "grabbing"; n.style.filter = PICKUP_SHADOW;
    });
    drawAt(0, 0);

    const frame = () => {
      const q = toLoc(pointer.x, pointer.y);
      const d = clampDelta((q.x - grabx) - orig[i].x, (q.y - graby) - orig[i].y);
      drawAt(d.x, d.y);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const move = (ev) => { pointer = { x: ev.clientX, y: ev.clientY }; };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      cancelAnimationFrame(raf);

      const q = toLoc(pointer.x, pointer.y);
      const d = clampDelta((q.x - grabx) - orig[i].x, (q.y - graby) - orig[i].y);
      const G = { x: (orig[i].x + d.x) - homes[i].hx, y: (orig[i].y + d.y) - homes[i].hy };

      const settle = (list, target, asPlaced) => {
        list.forEach((m) => {
          const n = pieceRefs.current[m]; if (!n) return;
          const t = target(m);
          n.style.cursor = asPlaced ? "default" : "grab";
          n.style.zIndex = asPlaced ? "10" : "20";
          n.style.transition = SETTLE;
          void n.offsetWidth;
          n.style.transform = `translate3d(${t.x - tabPad}px, ${t.y - tabPad}px, 0) scale(1)`;
          n.style.filter = REST_SHADOW;
          window.setTimeout(() => { const nn = pieceRefs.current[m]; if (nn) nn.style.willChange = "auto"; }, 320);
        });
      };
      const placeGroup = (list) => {
        const np = positions.slice();
        list.forEach((m) => { np[m] = { x: homes[m].hx, y: homes[m].hy, rot: 0 }; });
        settle(list, (m) => ({ x: homes[m].hx, y: homes[m].hy }), true);
        setPositions(np);
        setPlaced((pl) => {
          const q2 = pl.slice(); list.forEach((m) => { q2[m] = true; });
          if (q2.every(Boolean)) setTimeout(() => setShowReveal(true), 480);
          return q2;
        });
      };

      if (Math.hypot(G.x, G.y) <= SNAP) { placeGroup(members); return; }

      const draggedSet = new Set(members);
      const offsetOf = (label) => {
        for (let k = 0; k < gid.length; k++) if (gid[k] === label) return { x: positions[k].x - homes[k].hx, y: positions[k].y - homes[k].hy };
        return null;
      };
      const cand = new Map();
      members.forEach((m) => {
        gridNeighbors(m).forEach((n) => {
          if (draggedSet.has(n) || placed[n]) return;
          const off = offsetOf(gid[n]);
          if (off && Math.hypot(off.x - G.x, off.y - G.y) <= SNAP) cand.set(gid[n], off);
        });
      });

      if (cand.size) {
        let Ht = null, bestD = Infinity;
        cand.forEach((off) => { const dd = Math.hypot(off.x - G.x, off.y - G.y); if (dd < bestD) { bestD = dd; Ht = off; } });
        const mergeLabels = new Set([myGid]);
        cand.forEach((off, lab) => { if (Math.hypot(off.x - Ht.x, off.y - Ht.y) <= SNAP) mergeLabels.add(lab); });
        const newGid = gid.slice();
        const merged = [];
        for (let k = 0; k < newGid.length; k++) if (mergeLabels.has(gid[k])) { newGid[k] = myGid; merged.push(k); }

        if (Math.hypot(Ht.x, Ht.y) <= SNAP) { setGid(newGid); placeGroup(merged); return; }
        const np = positions.slice();
        merged.forEach((m) => { np[m] = { x: homes[m].hx + Ht.x, y: homes[m].hy + Ht.y, rot: 0 }; });
        settle(merged, (m) => ({ x: homes[m].hx + Ht.x, y: homes[m].hy + Ht.y }), false);
        setPositions(np);
        setGid(newGid);
        return;
      }

      const np = positions.slice();
      members.forEach((m) => { np[m] = { x: orig[m].x + d.x, y: orig[m].y + d.y, rot: 0 }; });
      settle(members, (m) => ({ x: orig[m].x + d.x, y: orig[m].y + d.y }), false);
      setPositions(np);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const replay = () => { setShowReveal(false); setPlaced(homes.map(() => false)); setGid(homes.map((_, i) => i)); setPositions(scatter()); };

  const buildRevealPng = (onBlob) => {
    const W = BW, H = BH;
    const dpr = window.devicePixelRatio || 1;
    const scr = window.screen || {};
    const sw = scr.width || 0, sh = scr.height || 0;
    let CW, CH;
    if (sh > sw && sw && sh) {
      CW = Math.max(1080, Math.round(sw * dpr));
      CH = Math.max(1920, Math.round(sh * dpr));
    } else {
      CW = 1080; CH = 1920;
    }
    const S = Math.min(CW / W, CH / H);
    const CREAM = "rgb(250,248,236)";

    const paint = (img) => {
      const canvas = document.createElement("canvas");
      canvas.width = CW; canvas.height = CH;
      const ctx = canvas.getContext("2d");

      // Fill canvas background with cream color before clipping
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, CW, CH);

      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(0, 0, CW, CH, 14 * S);
      else ctx.rect(0, 0, CW, CH);
      ctx.clip();

      if (img && img.width) {
        const s = Math.max(CW / img.width, CH / img.height);
        const dw = img.width * s, dh = img.height * s;
        ctx.drawImage(img, (CW - dw) / 2, (CH - dh) / 2, dw, dh);
      } else { ctx.fillStyle = "#050505"; ctx.fillRect(0, 0, CW, CH); }

      const cx = CW * 0.5, cy = CH * 0.42;
      const R = Math.hypot(Math.max(cx, CW - cx), Math.max(cy, CH - cy)) * 1.02;
      const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      vg.addColorStop(0, "rgba(23,19,13,0.34)");
      vg.addColorStop(0.78, "rgba(5,5,5,0.76)");
      vg.addColorStop(1, "rgba(5,5,5,0.76)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, CW, CH);

      const contentW = (W * 0.78) * S;
      ctx.font = `italic 400 ${20 * S}px "Playfair Display", Georgia, serif`;
      const msgLines = [];
      (data.message || "").split("\n").forEach((para) => {
        let line = "";
        para.split(" ").forEach((w) => {
          const test = line ? line + " " + w : w;
          if (ctx.measureText(test).width > contentW && line) { msgLines.push(line); line = w; }
          else line = test;
        });
        msgLines.push(line);
      });

      const rows = [];
      if (data.toName) rows.push({ type: "text", t: data.toName, f: `500 ${12.5 * S}px "JetBrains Mono", monospace`, color: "#E6C67F", ls: 0.1 * 12.5 * S, lh: 12.5 * S * 1.3, gap: 18 * S });
      msgLines.forEach((ln, i) => rows.push({ type: "text", t: ln, f: `italic 400 ${20 * S}px "Playfair Display", Georgia, serif`, color: "#F3ECDD", lh: 20 * S * 1.32, shadow: true, gap: i === msgLines.length - 1 ? 18 * S : 0 }));
      rows.push({ type: "rule", h: 2 * S, w: 44 * S, gap: data.fromName ? 14 * S : 0 });
      if (data.fromName) rows.push({ type: "text", t: data.fromName, f: `500 ${12 * S}px "JetBrains Mono", monospace`, color: "rgba(238,232,220,0.82)", ls: 0.08 * 12 * S, lh: 12 * S * 1.3, gap: 0 });

      const total = rows.reduce((s, r) => s + (r.h || r.lh) + r.gap, 0);
      let y = (CH - total) / 2;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      rows.forEach((r) => {
        const rowH = r.h || r.lh;
        if (r.type === "rule") {
          const gr = ctx.createLinearGradient(CW / 2 - r.w / 2, 0, CW / 2 + r.w / 2, 0);
          gr.addColorStop(0, "rgba(208,160,54,0)"); gr.addColorStop(0.5, "#D0A036"); gr.addColorStop(1, "rgba(208,160,54,0)");
          ctx.fillStyle = gr; ctx.fillRect(CW / 2 - r.w / 2, y + rowH / 2 - r.h / 2, r.w, r.h);
        } else {
          ctx.save();
          ctx.font = r.f; ctx.fillStyle = r.color;
          if ("letterSpacing" in ctx) ctx.letterSpacing = (r.ls || 0) + "px";
          if (r.shadow) { ctx.shadowColor = "rgba(5,5,5,0.92)"; ctx.shadowBlur = 9 * S; ctx.shadowOffsetY = 2 * S; }
          else { ctx.shadowColor = "rgba(5,5,5,0.8)"; ctx.shadowBlur = 5 * S; ctx.shadowOffsetY = 1 * S; }
          ctx.fillText(r.t, CW / 2, y + rowH / 2);
          ctx.restore();
        }
        y += rowH + r.gap;
      });

      canvas.toBlob((blob) => { onBlob(blob || null); }, "image/jpeg", 0.85);
    };

    const run = () => {
      if (data.cropImageUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => paint(img);
        img.onerror = () => paint(null);
        img.src = data.cropImageUrl;
      } else paint(null);
    };
    if (document.fonts && document.fonts.ready) {
      Promise.all([
        'italic 400 20px "Playfair Display"',
        '500 11px "JetBrains Mono"',
        '500 10px "JetBrains Mono"',
      ].map((w) => document.fonts.load(w).catch(() => {})))
        .then(() => document.fonts.ready).then(run, run);
    } else run();
  };

  const sharedFileRef = useRef(null);
  useEffect(() => {
    if (!showReveal) { sharedFileRef.current = null; return; }
    buildRevealPng((blob) => { if (blob) sharedFileRef.current = new File([blob], "jigzo-reveal.jpg", { type: "image/jpeg" }); });
  }, [showReveal]);

  const saveAsFile = (file) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = "jigzo-reveal.jpg";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };

  const onSaveOrShare = () => {
    const file = sharedFileRef.current;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "Your JIGZO reveal" }).catch((err) => {
        if (err && err.name === "AbortError") return;
        saveAsFile(file);
      });
      return;
    }
    if (file) saveAsFile(file);
    else buildRevealPng((blob) => { if (blob) saveAsFile(new File([blob], "jigzo-reveal.jpg", { type: "image/jpeg" })); });
  };

  const placedCount = placed.filter(Boolean).length;

  if (showReveal && !loaderRunning) {
    return (
      <div className="receive-page completed-flow" style={{ fontFamily: "Archia,sans-serif", color: "#1C1913",
        display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 40px", width: "100%" }}>
        <style>{`
          @keyframes jzFade { from { opacity:0; } to { opacity:1; } }
        `}</style>
        
        {/* completed reveal card (participates in normal document flow) */}
        <div id="revealCard" className="reveal-card-wrapper"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "440px",
            aspectRatio: "9 / 16",
            marginInline: "auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
            borderRadius: "14px",
            boxShadow: "0 8px 32px rgba(5,5,5,0.12)",
            animation: "jzFade 0.6s ease"
          }}>
          <div className="reveal-card" style={{ width: "100%", height: "100%", position: "relative", display: "block" }}>
            <img src={data.cropImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 100% at 50% 42%, rgba(23,19,13,0.34), rgba(5,5,5,0.76) 78%)" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", textAlign: "center", padding: "9% 11%" }}>
              {data.toName || data.recipients?.[rIndex]?.name ? (
                <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 500, fontSize: 12.5,
                  letterSpacing: "0.1em", color: "#E6C67F", marginBottom: 18, textShadow: "0 1px 4px rgba(5,5,5,0.8)" }}>{data.toName || data.recipients?.[rIndex]?.name}</div>
              ) : null}
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontWeight: 400, fontSize: 20,
                lineHeight: 1.32, color: "#F3ECDD", whiteSpace: "pre-line", maxWidth: "22ch",
                textShadow: "0 1px 3px rgba(5,5,5,0.92), 0 2px 22px rgba(5,5,5,0.6)" }}>
                {data.message || ""}
              </div>
              <div style={{ width: 44, height: 2, marginTop: 18, background: "linear-gradient(90deg, rgba(208,160,54,0), #D0A036, rgba(208,160,54,0))" }} />
              {data.fromName ? (
                <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 500, fontSize: 12,
                  letterSpacing: "0.08em", color: "rgba(238,232,220,0.82)", marginTop: 14, textShadow: "0 1px 4px rgba(5,5,5,0.8)" }}>{data.fromName}</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* solved controls (placed below in normal flow with safe-area spacing) */}
        <div style={{ textAlign: "center", marginTop: 24, width: "100%", animation: "jzFade 0.5s ease" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            {/* Primary: Save or Share */}
            <button type="button" onClick={onSaveOrShare} style={{ background: "#050505", color: "#FAF8EC", border: "none", borderRadius: 999,
              padding: "13px 26px", fontSize: 14.5, fontWeight: 700, fontFamily: "Archia,sans-serif", cursor: "pointer", width: "100%", maxWidth: 280 }}>
              Save or Share
            </button>
            
            {/* Secondary: Create Your Puzzle */}
            <button type="button" onClick={() => window.location.href = "/create"} style={{ background: "transparent", color: "#050505", border: "1.5px solid #050505",
              borderRadius: 999, padding: "13px 26px", fontSize: 14.5, fontWeight: 600, fontFamily: "Archia,sans-serif", cursor: "pointer", width: "100%", maxWidth: 280 }}>
              Create Your Puzzle
            </button>

            {/* Tertiary text action: Replay Puzzle */}
            <button type="button" onClick={replay} style={{ background: "none", border: "none", color: "rgba(5,5,5,0.6)",
              fontSize: 13.5, fontWeight: 600, fontFamily: "Archia,sans-serif", cursor: "pointer", textDecoration: "underline", marginTop: 4 }}>
              Replay Puzzle
            </button>
          </div>
          
          {/* Minimal branding */}
          <div style={{ marginTop: 24, opacity: 0.8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(5,5,5,0.7)" }}>Created with care.</div>
            <div style={{ fontSize: 10.5, fontWeight: 500, color: "rgba(5,5,5,0.42)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>Made with JIGZO</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="receive-page" style={{ fontFamily: "Archia,sans-serif", color: "#1C1913",
      display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 14px 20px" }}>
      <style>{`
        @keyframes jzFade { from { opacity:0; } to { opacity:1; } }
      `}</style>
      <div style={showReveal ? { width: "100%", display: "flex", flexDirection: "column", alignItems: "center" } : { width: "100%", maxWidth: 440 }}>
        {/* above the puzzle — heading + live piece counter */}
        {!showReveal && (
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <h1 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 4px", letterSpacing: "-0.015em", color: "#050505" }}>
              Solve to reveal your message
            </h1>
            <p style={{ fontSize: 13, color: "rgba(5,5,5,0.6)", margin: "0 0 8px" }}>
              Move the pieces into place.
            </p>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#B8935A", letterSpacing: "0.04em" }}>
              {placedCount} / {homes.length} pieces placed
            </div>
          </div>
        )}

        {/* interactive stage (scaled to fit width & height) */}
        <div ref={wrapRef} style={{ width: "100%", maxWidth: stageW, margin: "0 auto", height: currentStageH * scale, position: "relative" }}>
          <div
            ref={stageRef}
            style={{
              width: stageW,
              height: currentStageH,
              transform: `translateX(-50%) scale(${scale})`,
              transformOrigin: "top center",
              position: "absolute",
              top: 0,
              left: "50%",
              background: showReveal ? "transparent" : "#FAF8EC",
              borderRadius: 16,
              boxShadow: showReveal ? "none" : "0 4px 24px rgba(5,5,5,0.06)"
            }}
          >
            {/* board frame — hidden when solved to avoid background tray showing */}
            {!showReveal && (
              <div style={{ position: "absolute", left: PAD, top: PAD, width: BW, height: BH, borderRadius: 14,
                zIndex: 0, boxShadow: "inset 0 0 0 1.5px rgba(5,5,5,0.16)", background: "rgba(5,5,5,0.02)" }} />
            )}

            {/* pieces — positioned with GPU-friendly translate3d */}
            {!showReveal && homes.map((h, i) => {
              const pos = positions[i];
              const d = piecePath(h.r, h.c, cols, rows, pieceW, pieceH, edgeMap);
              return (
                <div key={i} data-piece={i}
                  ref={(el) => { pieceRefs.current[i] = el; }}
                  onPointerDown={(e) => onDown(i, e)}
                  style={{ position: "absolute", left: 0, top: 0, width: elemW, height: elemH,
                    transform: `translate3d(${pos.x - tabPad}px, ${pos.y - tabPad}px, 0) rotate(${pos.rot || 0}deg)`,
                    transition: SETTLE, cursor: placed[i] ? "default" : "grab", touchAction: "none",
                    zIndex: placed[i] ? 10 : 20, filter: REST_SHADOW }}>
                  <svg viewBox={`${-tabPad} ${-tabPad} ${elemW} ${elemH}`} width={elemW} height={elemH} style={{ display: "block", pointerEvents: "none", overflow: "visible" }}>
                    <defs><clipPath id={`rp-${i}`}><path d={d} /></clipPath></defs>
                    <g clipPath={`url(#rp-${i})`}>
                      <image href={data.cropImageUrl} x={-h.c * pieceW} y={-h.r * pieceH} width={BW} height={BH} preserveAspectRatio="xMidYMid slice" />
                    </g>
                    <path d={d} fill="none" stroke="rgba(5,5,5,0.32)" strokeWidth="1.1" />
                  </svg>
                </div>
              );
            })}

            {/* reveal card (also the download target) */}
            {showReveal && (
              <div ref={cardRef} id="revealCard" className="reveal-card-wrapper"
                style={{
                  position: "relative",
                  width: "min(100%, 440px)",
                  aspectRatio: "9 / 16",
                  marginInline: "auto",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  overflow: "hidden",
                  borderRadius: "14px",
                  zIndex: 40,
                  animation: "jzFade 0.6s ease"
                }}>
                <div className="reveal-card" style={{ width: "100%", height: "100%", position: "relative", display: "block", marginInline: "auto", left: "auto", right: "auto", transform: "none" }}>
                  <img src={data.cropImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 100% at 50% 42%, rgba(23,19,13,0.34), rgba(5,5,5,0.76) 78%)" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", textAlign: "center", padding: "9% 11%" }}>
                    {data.toName || data.recipients?.[rIndex]?.name ? (
                      <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 500, fontSize: 12.5,
                        letterSpacing: "0.1em", color: "#E6C67F", marginBottom: 18, textShadow: "0 1px 4px rgba(5,5,5,0.8)" }}>{data.toName || data.recipients?.[rIndex]?.name}</div>
                    ) : null}
                    <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontWeight: 400, fontSize: 20,
                      lineHeight: 1.32, color: "#F3ECDD", whiteSpace: "pre-line", maxWidth: "22ch",
                      textShadow: "0 1px 3px rgba(5,5,5,0.92), 0 2px 22px rgba(5,5,5,0.6)" }}>
                      {data.message || ""}
                    </div>
                    <div style={{ width: 44, height: 2, marginTop: 18, background: "linear-gradient(90deg, rgba(208,160,54,0), #D0A036, rgba(208,160,54,0))" }} />
                    {data.fromName ? (
                      <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 500, fontSize: 12,
                        letterSpacing: "0.08em", color: "rgba(238,232,220,0.82)", marginTop: 14, textShadow: "0 1px 4px rgba(5,5,5,0.8)" }}>{data.fromName}</div>
                    ) : null}
                  </div>
                </div>

                {/* Puzzle Reveal Transition beat — plays over the card exactly, then dissolves */}
                {loaderRunning && <RevealBeat radius={100} />}
              </div>
            )}
          </div>
        </div>

        {/* solved controls */}
        {showReveal && !loaderRunning && (
          <div style={{ textAlign: "center", marginTop: 18, animation: "jzFade 0.5s ease" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              {/* Primary: Save or Share */}
              <button type="button" onClick={onSaveOrShare} style={{ background: "#050505", color: "#FAF8EC", border: "none", borderRadius: 999,
                padding: "13px 26px", fontSize: 14.5, fontWeight: 700, fontFamily: "Archia,sans-serif", cursor: "pointer", width: "100%", maxWidth: 280 }}>
                Save or Share
              </button>
              
              {/* Secondary: Create Your Puzzle */}
              <button type="button" onClick={() => window.location.href = "/create"} style={{ background: "transparent", color: "#050505", border: "1.5px solid #050505",
                borderRadius: 999, padding: "13px 26px", fontSize: 14.5, fontWeight: 600, fontFamily: "Archia,sans-serif", cursor: "pointer", width: "100%", maxWidth: 280 }}>
                Create Your Puzzle
              </button>

              {/* Tertiary text action: Replay Puzzle */}
              <button type="button" onClick={replay} style={{ background: "none", border: "none", color: "rgba(5,5,5,0.6)",
                fontSize: 13.5, fontWeight: 600, fontFamily: "Archia,sans-serif", cursor: "pointer", textDecoration: "underline", marginTop: 4 }}>
                Replay Puzzle
              </button>
            </div>
            
            {/* Minimal branding */}
            <div style={{ marginTop: 24, opacity: 0.8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(5,5,5,0.7)" }}>Created with care.</div>
              <div style={{ fontSize: 10.5, fontWeight: 500, color: "rgba(5,5,5,0.42)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>Made with JIGZO</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
