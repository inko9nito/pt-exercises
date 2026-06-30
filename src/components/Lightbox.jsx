import { useState } from 'react';
import { XIcon } from './Icons.jsx';
import { assetUrl } from '../utils/asset.js';
import { useSwipe } from '../utils/useSwipe.js';

export default function Lightbox({ images, initialIndex, alt, onClose }) {
  const [idx, setIdx] = useState(initialIndex);

  const goTo = (i) => setIdx(Math.max(0, Math.min(images.length - 1, i)));

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => goTo(idx + 1),
    onSwipeRight: () => goTo(idx - 1),
  });

  return (
    <div className="lightbox" {...swipeHandlers}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        <XIcon size={20} />
      </button>
      <img
        src={assetUrl(images[idx])}
        alt={`${alt} — enlarged`}
        className="lightbox-img"
        draggable={false}
      />
      {images.length > 1 && (
        <div className="lightbox-pips">
          {images.map((_, i) => (
            <span key={i} className={`hero-pip ${i === idx ? 'active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
