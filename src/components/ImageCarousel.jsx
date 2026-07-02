import { useState, useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, PauseIcon } from './Icons.jsx';
import { assetUrl } from '../utils/asset.js';
import Lightbox from './Lightbox.jsx';

const ANIM_INTERVAL_MS = 900;
const AXIS_LOCK_PX = 8;
const SWIPE_THRESHOLD = 40;
const EDGE_RESISTANCE = 0.35;

export default function ImageCarousel({ images, alt }) {
  // slide 0 = animated preview (when there's more than one frame); the
  // remaining slides are the individual still images.
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [animFrame, setAnimFrame] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const timerRef = useRef(null);

  const hasAnimation = images && images.length > 1;
  const slideCount = images ? images.length + (hasAnimation ? 1 : 0) : 0;

  useEffect(() => {
    if (hasAnimation && idx === 0 && playing) {
      timerRef.current = setInterval(() => {
        setAnimFrame((f) => (f + 1) % images.length);
      }, ANIM_INTERVAL_MS);
      return () => clearInterval(timerRef.current);
    }
  }, [hasAnimation, idx, playing, images?.length]);

  if (!images || images.length === 0) return null;

  const goTo = (i) => setIdx(Math.max(0, Math.min(slideCount - 1, i)));
  const prev = (e) => { e.stopPropagation(); goTo(idx - 1); };
  const next = (e) => { e.stopPropagation(); goTo(idx + 1); };

  // Axis-locked gesture: a horizontal drag slides the track with the finger
  // and snaps to a slide on release (never scrolling the page); a vertical
  // drag is forwarded to the detail scroll container so the page still
  // scrolls. touch-action is none on the carousel so the browser can't steal
  // the vertical part of a diagonal swipe.
  const gesture = useRef(null);
  const dragged = useRef(false);

  const onPointerDown = (e) => {
    gesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      dx: 0,
      axis: null,
      scroller: e.currentTarget.closest('.detail-scroll'),
    };
    dragged.current = false;
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.axis && (Math.abs(dx) > AXIS_LOCK_PX || Math.abs(dy) > AXIS_LOCK_PX)) {
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      dragged.current = true;
      if (g.axis === 'x') setDragging(true);
    }
    if (g.axis === 'x') {
      // Rubber-band past the first/last slide instead of a dead stop.
      const atEdge = (idx === 0 && dx > 0) || (idx === slideCount - 1 && dx < 0);
      setDragX(atEdge ? dx * EDGE_RESISTANCE : dx);
    } else if (g.axis === 'y' && g.scroller) {
      g.scroller.scrollTop -= e.clientY - g.lastY;
    }
    g.lastY = e.clientY;
    g.dx = dx;
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.axis !== 'x') return;
    setDragging(false);
    setDragX(0);
    if (g.dx <= -SWIPE_THRESHOLD) goTo(idx + 1);
    else if (g.dx >= SWIPE_THRESHOLD) goTo(idx - 1);
  };

  const swipeHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };

  // Trailing click after a drag shouldn't also open the lightbox / toggle play.
  const consumedDrag = () => {
    if (dragged.current) {
      dragged.current = false;
      return true;
    }
    return false;
  };

  const togglePlay = (e) => {
    e.stopPropagation();
    if (consumedDrag()) return;
    setPlaying((p) => !p);
  };

  const openLightbox = (stillIndex) => {
    if (consumedDrag()) return;
    setLightboxIndex(stillIndex);
  };

  return (
    <>
      <div className="hero-carousel" {...swipeHandlers}>
        <div
          className="hero-track"
          style={{
            transform: `translateX(calc(${-idx * 100}% + ${dragX}px))`,
            transition: dragging ? 'none' : 'transform .32s cubic-bezier(0.22, 0.61, 0.36, 1)',
          }}
        >
          {hasAnimation && (
            <div className="hero-slide">
              <div className="hero-anim" onClick={togglePlay}>
                <img
                  src={assetUrl(images[animFrame])}
                  alt={`${alt} — animated preview`}
                  className="hero-img"
                  draggable={false}
                />
                <button className="hero-play-toggle" onClick={togglePlay} aria-label={playing ? 'Pause animation' : 'Play animation'}>
                  {playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
                </button>
              </div>
            </div>
          )}
          {images.map((src, i) => (
            <div className="hero-slide" key={i}>
              <img
                src={assetUrl(src)}
                alt={`${alt} — step ${i + 1}`}
                className="hero-img"
                onClick={() => openLightbox(i)}
                draggable={false}
              />
            </div>
          ))}
        </div>

        {slideCount > 1 && (
          <>
            <button className="hero-arrow hero-arrow-left" onClick={prev} aria-label="Previous">
              <ChevronLeftIcon size={18} />
            </button>
            <button className="hero-arrow hero-arrow-right" onClick={next} aria-label="Next">
              <ChevronRightIcon size={18} />
            </button>
          </>
        )}

        {slideCount > 1 && (
          <div className="hero-pips">
            {hasAnimation && (
              <span className={`hero-pip hero-pip-anim ${idx === 0 ? 'active' : ''}`}>
                <PlayIcon size={7} />
              </span>
            )}
            {images.map((_, i) => (
              <span
                key={i}
                className={`hero-pip ${idx === i + (hasAnimation ? 1 : 0) ? 'active' : ''}`}
              />
            ))}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          initialIndex={lightboxIndex}
          alt={alt}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
