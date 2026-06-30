import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons.jsx';
import { assetUrl } from '../utils/asset.js';

export default function ImageCarousel({ images, alt }) {
  const [idx, setIdx] = useState(0);

  if (!images || images.length === 0) return null;

  const prev = (e) => {
    e.stopPropagation();
    setIdx((i) => (i - 1 + images.length) % images.length);
  };
  const next = (e) => {
    e.stopPropagation();
    setIdx((i) => (i + 1) % images.length);
  };

  return (
    <div className="hero-carousel">
      <img
        src={assetUrl(images[idx])}
        alt={`${alt} — step ${idx + 1}`}
        className="hero-img"
      />
      {images.length > 1 && (
        <>
          <button className="hero-arrow hero-arrow-left" onClick={prev} aria-label="Previous image">
            <ChevronLeftIcon size={18} />
          </button>
          <button className="hero-arrow hero-arrow-right" onClick={next} aria-label="Next image">
            <ChevronRightIcon size={18} />
          </button>
          <div className="hero-pips">
            {images.map((_, i) => (
              <span key={i} className={`hero-pip ${i === idx ? 'active' : ''}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
