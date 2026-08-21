import { useCallback, useRef, useState } from 'react';

// Shared pan/zoom/rotate crop-stage math, extracted from the consumer /create photo
// step (frontend/src/pages/CreatePage.jsx) so any surface that needs the same
// "drag to pan, pinch/slider to zoom, bake to a fixed-aspect canvas" interaction
// reuses one implementation instead of re-deriving the clamp/capture math.
// CreatePage.jsx itself is intentionally left untouched by this extraction (it is a
// locked, revenue-critical consumer flow) — this hook is a faithful port of its
// pointer/pinch/clamp/capture logic, parameterized so other surfaces (e.g. Business
// Studio) can drive a different frame/output aspect ratio.
export function useImageCropStage({ minZoom = 1, maxZoom = 3, initialZoom = 1.2 } = {}) {
  const [zoom, setZoom] = useState(initialZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const pointersRef = useRef(new Map());
  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const frameRef = useRef(null);
  const imageRef = useRef(null);

  const clampPan = useCallback((x, y, scaleVal) => {
    const frame = frameRef.current;
    const imgEl = imageRef.current;
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

  const reset = useCallback((zoomValue = initialZoom) => {
    setZoom(zoomValue);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  }, [initialZoom]);

  const onPointerDown = useCallback((e) => {
    const frame = frameRef.current;
    if (!frame) return;
    if (e.pointerType === 'touch' && frame.setPointerCapture) {
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
  }, [zoom, pan]);

  const onPointerMove = useCallback((e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const a = pts[0], b = pts[1];
      const frame = frameRef.current, r = frame.getBoundingClientRect();
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const curMid = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
      const g = pinchRef.current;
      const z1 = Math.max(minZoom, Math.min(maxZoom, g.startZoom * (dist / g.startDist)));
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
  }, [zoom, clampPan, minZoom, maxZoom]);

  const onPointerUp = useCallback((e) => {
    const frame = frameRef.current;
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
  }, [pan]);

  const onZoomChange = useCallback((nextZoom) => {
    const z = Math.max(minZoom, Math.min(maxZoom, nextZoom));
    setZoom(z);
    setPan(p => clampPan(p.x, p.y, z));
  }, [clampPan, minZoom, maxZoom]);

  // Bakes the current pan/zoom/rotation onto a fixed-size canvas, matching the frame's
  // on-screen composition (blurred cover fill behind a contained, transformed image).
  // Returns the canvas so the caller can pick toDataURL() or toBlob().
  const captureCrop = useCallback((outW, outH, { backgroundFill = '#050505', blurBackground = true } = {}) => {
    const imgEl = imageRef.current;
    const frame = frameRef.current;
    if (!imgEl || !frame || !imgEl.naturalWidth) return null;
    const rect = frame.getBoundingClientRect();
    const Wf = rect.width, Hf = rect.height;
    const Wi = imgEl.naturalWidth, Hi = imgEl.naturalHeight;
    const k = outW / Wf;
    const containScale = Math.min(Wf / Wi, Hf / Hi);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = backgroundFill;
    ctx.fillRect(0, 0, outW, outH);
    if (blurBackground) {
      try {
        ctx.save();
        ctx.filter = 'blur(26px) brightness(0.5)';
        const cover = Math.max(outW / Wi, outH / Hi);
        const cw = Wi * cover, ch = Hi * cover;
        ctx.drawImage(imgEl, (outW - cw) / 2, (outH - ch) / 2, cw, ch);
        ctx.restore();
        ctx.filter = 'none';
      } catch (e) {
        ctx.filter = 'none';
      }
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.translate(pan.x * k, pan.y * k);
    ctx.rotate(rotation * Math.PI / 180);
    const sEff = containScale * zoom * k;
    ctx.scale(sEff, sEff);
    ctx.drawImage(imgEl, -Wi / 2, -Hi / 2, Wi, Hi);
    ctx.restore();

    return canvas;
  }, [zoom, pan, rotation]);

  return {
    zoom, setZoom: onZoomChange,
    pan, rotation, setRotation,
    frameRef, imageRef,
    onPointerDown, onPointerMove, onPointerUp,
    reset, captureCrop,
  };
}
