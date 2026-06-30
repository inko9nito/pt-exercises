import { useState, useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, PauseIcon } from './Icons.jsx';
import { assetUrl } from '../utils/asset.js';
import { useSwipe } from '../utils/useSwipe.js';
import Lightbox from './Lightbox.jsx';

const ANIM_INTERVAL_MS = 900;

export default function ImageCarousel({ images, alt }) {
  // idx 0 = animated preview slide, idx 1..N = still images (images[idx - 1])
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [animFrame, setAnimFrame] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
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

  const goTo = (i) => setIdx(((i % slideCount) + slideCount) % slideCount);
  const prev = (e) => { e.stopPropagation(); goTo(idx - 1); };
  const next = (e) => { e.stopPropagation(); goTo(idx + 1); };

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => goTo(idx + 1),
    onSwipeRight: () => goTo(idx - 1),
  });

  const isAnimSlide = hasAnimation && idx === 0;
  const stillSrc = isAnimSlide ? null : images[hasAnimation ? idx - 1 : idx];

  const handleImageTap = () => {
    if (isAnimSlide) {
      setPlaying((p) => !p);
    } else {
      const stillIndex = hasAnimation ? idx - 1 : idx;
      setLightboxIndex(stillIndex);
    }
  };

  return (
    <>
      <div className="hero-carousel" {...swipeHandlers}>
        {isAnimSlide ? (
          <div className="hero-anim" onClick={handleImageTap}>
            <img
              src={assetUrl(images[animFrame])}
              alt={`${alt} — animated preview`}
              className="hero-img"
              draggable={false}
            />
            <button
              className="hero-play-toggle"
              onClick={(e) => { e.stopPropagation(); setPlaying((p) => !p); }}
              aria-label={playing ? 'Pause animation' : 'Play animation'}
            >
              {playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
            </button>
          </div>
        ) : (
          <img
            src={assetUrl(stillSrc)}
            alt={`${alt} — step ${hasAnimation ? idx : idx + 1}`}
            className="hero-img"
            onClick={handleImageTap}
            draggable={false}
          />
        )}

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
