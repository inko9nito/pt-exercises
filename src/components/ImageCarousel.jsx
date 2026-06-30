import { useState } from 'react';

export default function ImageCarousel({ images, alt }) {
  const [idx, setIdx] = useState(0);

  if (!images || images.length === 0) return null;

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  return (
    <div className="carousel">
      <img
        src={images[idx]}
        alt={`${alt} — step ${idx + 1}`}
        className="carousel-img"
        loading="lazy"
      />
      {images.length > 1 && (
        <div className="carousel-controls">
          <button onClick={prev} className="carousel-arrow" aria-label="Previous">‹</button>
          <div className="carousel-pips">
            {images.map((_, i) => (
              <button
                key={i}
                className={`carousel-pip ${i === idx ? 'active' : ''}`}
                onClick={() => setIdx(i)}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
          <button onClick={next} className="carousel-arrow" aria-label="Next">›</button>
        </div>
      )}
    </div>
  );
}
