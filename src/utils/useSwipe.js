import { useRef } from 'react';

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 40 }) {
  const startX = useRef(null);
  const deltaX = useRef(0);
  const active = useRef(false);

  const onPointerDown = (e) => {
    startX.current = e.clientX;
    deltaX.current = 0;
    active.current = true;
  };

  const onPointerMove = (e) => {
    if (!active.current) return;
    deltaX.current = e.clientX - startX.current;
  };

  const endSwipe = () => {
    if (!active.current) return;
    if (deltaX.current > threshold) onSwipeRight?.();
    else if (deltaX.current < -threshold) onSwipeLeft?.();
    active.current = false;
    startX.current = null;
    deltaX.current = 0;
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endSwipe,
    onPointerCancel: endSwipe,
  };
}
