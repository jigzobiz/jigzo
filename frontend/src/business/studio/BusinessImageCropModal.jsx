import React, { useEffect } from 'react';
import { useImageCropStage } from '../../components/imageCropStage';
import { BUSINESS_INVITATION_CARD } from '../../business/invitationCardGeometry';

// This crop tool positions the FINAL revealed-invitation image — the 4:5 portrait card
// (locked Claude Design recipient spec, revision 2) shown in Studio's final preview and
// the real post-solve reveal (SolvedInvitationFrame). It is deliberately NOT the puzzle-
// solving board's shape: the puzzle is always solved using CONSUMER_PUZZLE_GEOMETRY
// (9:16, same as consumer Receive — see puzzle-geometry.js), and the SAME baked image
// below is re-sliced into that different, narrower shape at solve time via the puzzle
// piece renderer's own `preserveAspectRatio="xMidYMid slice"` — a plain center-crop cover
// fit, not a second stored asset. The sender only ever frames the FINAL card here; the
// guest sees a center-cropped subset of that same framing while solving, then the full
// approved framing on reveal. The bake resolution is derived from BUSINESS_INVITATION_CARD,
// scaled up for on-screen quality — never a separately hardcoded number — so the crop
// frame, this output, and the Studio/reveal previews can't drift apart.
const CROP_RESOLUTION_SCALE = 3.125; // 288x360 card -> 900x1125 bake, ample for preview/solve quality
const OUTPUT_W = BUSINESS_INVITATION_CARD.width * CROP_RESOLUTION_SCALE;
const OUTPUT_H = BUSINESS_INVITATION_CARD.height * CROP_RESOLUTION_SCALE;

// Reuses the same pan/zoom/rotate/crop-bake mechanics as the consumer /create photo
// step (see components/imageCropStage.js), framed as the 4:5 final-invitation card so
// the customer positions their photo in the shape it will actually be revealed in.
export default function BusinessImageCropModal({ imgSrc, onCancel, onDone, copy, isArabic }) {
  const stage = useImageCropStage({ initialZoom: 1.15, minZoom: 1, maxZoom: 3 });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const confirm = () => {
    const canvas = stage.captureCrop(OUTPUT_W, OUTPUT_H, { backgroundFill: '#050505' });
    if (!canvas) return;
    canvas.toBlob((blob) => { if (blob) onDone(blob); }, 'image/jpeg', 0.92);
  };

  return <div className="jzs-crop-overlay" role="dialog" aria-modal="true" aria-label={copy.puzzle.cropTitle} dir={isArabic ? 'rtl' : 'ltr'}>
    <div className="jzs-crop-modal">
      <h2>{copy.puzzle.cropTitle}</h2>
      <p>{copy.puzzle.cropHint}</p>
      <div
        ref={stage.frameRef}
        className="jzs-crop-frame"
        onPointerDown={stage.onPointerDown}
        onPointerMove={stage.onPointerMove}
        onPointerUp={stage.onPointerUp}
        onPointerCancel={stage.onPointerUp}
        onPointerLeave={stage.onPointerUp}
      >
        <img src={imgSrc} alt="" aria-hidden="true" draggable={false} className="jzs-crop-frame__backdrop" />
        <img
          ref={stage.imageRef}
          src={imgSrc}
          alt=""
          draggable={false}
          className="jzs-crop-frame__image"
          style={{ transform: `translate(${stage.pan.x}px, ${stage.pan.y}px) rotate(${stage.rotation}deg) scale(${stage.zoom})` }}
        />
        {[{ top: true, left: true }, { top: true, left: false }, { top: false, left: true }, { top: false, left: false }].map((pos, i) => (
          <span key={i} className="jzs-crop-frame__corner" style={{
            top: pos.top ? 10 : 'auto', bottom: pos.top ? 'auto' : 10,
            left: pos.left ? 10 : 'auto', right: pos.left ? 'auto' : 10,
            borderBottom: pos.top ? 'none' : undefined, borderTop: pos.top ? undefined : 'none',
            borderRight: pos.left ? 'none' : undefined, borderLeft: pos.left ? undefined : 'none'
          }} />
        ))}
      </div>
      <div className="jzs-crop-zoom">
        <span aria-hidden="true">−</span>
        <input type="range" min="1" max="3" step="0.01" value={stage.zoom} onChange={(e) => stage.setZoom(parseFloat(e.target.value))} />
        <span aria-hidden="true">+</span>
      </div>
      <div className="jzs-crop-rotate">
        <button type="button" className="jzs-action jzs-action--ghost jzs-action--sm" onClick={() => stage.setRotation(r => r - 90)}>↺ {copy.puzzle.rotateLeft}</button>
        <button type="button" className="jzs-action jzs-action--ghost jzs-action--sm" onClick={() => stage.setRotation(r => r + 90)}>{copy.puzzle.rotateRight} ↻</button>
      </div>
      <div className="jzs-crop-actions">
        <button type="button" className="jzs-action jzs-action--ghost" onClick={onCancel}>{copy.puzzle.cropCancel}</button>
        <button type="button" className="jzs-action" onClick={confirm}>{copy.puzzle.cropApply}</button>
      </div>
    </div>
  </div>;
}
