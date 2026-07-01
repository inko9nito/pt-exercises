import { useRef, useState, useEffect, useCallback } from 'react';

const PULL_THRESHOLD = 64;
const MAX_PULL = 96;
const MIN_SPINNER_MS = 500;

function ActivitySpinner({ spinning }) {
  return (
    <div className={`ios-spinner ${spinning ? 'is-spinning' : ''}`}>
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${-(8 - i) * 0.11}s` }} />
      ))}
    </div>
  );
}

export default function PullToRefresh({ onRefresh, children }) {
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const draggingRef = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const [pullDistance, setPullDistanceState] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [snapping, setSnapping] = useState(false);

  const setPull = useCallback((value) => {
    pullRef.current = value;
    setPullDistanceState(value);
  }, []);

  const triggerRefresh = useCallback(async () => {
    refreshingRef.current = true;
    setRefreshing(true);
    setSnapping(false);
    setPull(PULL_THRESHOLD);
    const start = Date.now();
    try {
      await onRefresh();
    } catch {
      // offline or blocked — the live subscription will resync once connected
    } finally {
      const wait = MIN_SPINNER_MS - (Date.now() - start);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setSnapping(true);
      setRefreshing(false);
      refreshingRef.current = false;
      setPull(0);
    }
  }, [onRefresh, setPull]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e) {
      if (refreshingRef.current) return;
      if (el.scrollTop <= 0) {
        startYRef.current = e.touches[0].clientY;
        draggingRef.current = true;
        setSnapping(false);
      }
    }

    function onTouchMove(e) {
      if (!draggingRef.current || refreshingRef.current) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        draggingRef.current = false;
        setPull(0);
        return;
      }
      e.preventDefault();
      setPull(Math.min(delta * 0.45, MAX_PULL));
    }

    function onTouchEnd() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (pullRef.current >= PULL_THRESHOLD) {
        triggerRefresh();
      } else {
        setSnapping(true);
        setPull(0);
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [triggerRefresh, setPull]);

  const indicatorOpacity = refreshing ? 1 : Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <main ref={containerRef} className="app-main pull-refresh-scroll">
      <div className="pull-refresh-indicator" style={{ opacity: indicatorOpacity }}>
        <ActivitySpinner spinning={refreshing} />
      </div>
      <div
        className={`pull-refresh-content ${snapping ? 'is-snapping' : ''}`}
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {children}
      </div>
    </main>
  );
}
