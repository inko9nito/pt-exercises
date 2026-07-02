import { useState, useRef, useCallback } from 'react';
import { XIcon } from './Icons.jsx';
import { assetUrl } from '../utils/asset.js';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const SWIPE_THRESHOLD = 50;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export default function Lightbox({ images, initialIndex, alt, onClose }) {
  const [idx, setIdx] = useState(initialIndex);
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 });
  const tRef = useRef(t);

  const stageRef = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const pan = useRef(null);
  const lastTap = useRef(0);
  const moved = useRef(false);

  const apply = (nt) => {
    tRef.current = nt;
    setT(nt);
  };
  const reset = () => apply({ scale: 1, x: 0, y: 0 });

  const goTo = useCallback(
    (i) => {
      setIdx(((i % images.length) + images.length) % images.length);
      reset();
    },
    [images.length]
  );

  const center = () => {
    const r = stageRef.current.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };

  // Keep the (zoomed) image from being dragged completely off-centre.
  const clamp = (nt) => {
    const img = stageRef.current?.querySelector('img');
    if (!img) return nt;
    const maxX = Math.max(0, (img.offsetWidth * nt.scale - img.offsetWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * nt.scale - img.offsetHeight) / 2);
    return {
      scale: nt.scale,
      x: Math.min(maxX, Math.max(-maxX, nt.x)),
      y: Math.min(maxY, Math.max(-maxY, nt.y)),
    };
  };

  const zoomTo = (scale, clientX, clientY) => {
    const { cx, cy } = center();
    // From fit (scale 1, offset 0), anchoring the tapped point:
    apply(clamp({ scale, x: (clientX - cx) * (1 - scale), y: (clientY - cy) * (1 - scale) }));
  };

  const onPointerDown = (e) => {
    stageRef.current.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      pinch.current = {
        startDist: dist(p1, p2),
        startScale: tRef.current.scale,
        startT: { x: tRef.current.x, y: tRef.current.y },
        startMid: mid(p1, p2),
      };
      pan.current = null;
    } else {
      pan.current = { x: e.clientX, y: e.clientY, startT: { ...tRef.current } };
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()];
      const s = Math.min(MAX_SCALE, Math.max(1, pinch.current.startScale * (dist(p1, p2) / pinch.current.startDist)));
      const r = s / pinch.current.startScale;
      const { cx, cy } = center();
      const mrelX = pinch.current.startMid.x - cx;
      const mrelY = pinch.current.startMid.y - cy;
      const cur = mid(p1, p2);
      const x = mrelX - (mrelX - pinch.current.startT.x) * r + (cur.x - pinch.current.startMid.x);
      const y = mrelY - (mrelY - pinch.current.startT.y) * r + (cur.y - pinch.current.startMid.y);
      apply(clamp({ scale: s, x, y }));
      moved.current = true;
    } else if (pan.current && pointers.current.size === 1) {
      const dx = e.clientX - pan.current.x;
      const dy = e.clientY - pan.current.y;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved.current = true;
      if (tRef.current.scale > 1) {
        apply(clamp({ scale: tRef.current.scale, x: pan.current.startT.x + dx, y: pan.current.startT.y + dy }));
      }
    }
  };

  const onPointerUp = (e) => {
    const wasPinch = !!pinch.current;
    const startX = pan.current?.x ?? e.clientX;
    const startY = pan.current?.y ?? e.clientY;
    pointers.current.delete(e.pointerId);
    stageRef.current.releasePointerCapture?.(e.pointerId);

    if (pointers.current.size >= 2) return;
    if (wasPinch) {
      pinch.current = null;
      if (tRef.current.scale <= 1.01) reset();
      // hand the remaining finger to pan cleanly (avoid a jump)
      if (pointers.current.size === 1) {
        const [p] = [...pointers.current.values()];
        pan.current = { x: p.x, y: p.y, startT: { ...tRef.current } };
      }
      return;
    }
    if (pointers.current.size > 0) return;
    pan.current = null;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const zoomed = tRef.current.scale > 1.01;

    // Swipe between images only when fit-to-screen.
    if (!zoomed && Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      goTo(idx + (dx < 0 ? 1 : -1));
      return;
    }

    if (!moved.current) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        if (zoomed) reset();
        else zoomTo(DOUBLE_TAP_SCALE, e.clientX, e.clientY);
      } else {
        lastTap.current = now;
      }
    }
  };

  return (
    <div className="lightbox">
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        <XIcon size={20} />
      </button>
      <div
        className="lightbox-stage"
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={assetUrl(images[idx])}
          alt={`${alt} — enlarged`}
          className="lightbox-img"
          draggable={false}
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})` }}
        />
      </div>
      {images.length > 1 && t.scale <= 1.01 && (
        <div className="lightbox-pips">
          {images.map((_, i) => (
            <span key={i} className={`hero-pip ${i === idx ? 'active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
