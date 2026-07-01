import { useRef, useState, useEffect, useCallback } from 'react';

// Matched against how far iOS Mail requires a pull before its spinner
// fully forms and release actually triggers a refresh — our previous
// 64px threshold was easy to hit with an ordinary scroll-up attempt.
const PULL_THRESHOLD = 150;
const MAX_PULL = 220;
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

    // touchmove is only ever registered non-passive for the duration of an
    // actual pull-from-top gesture, and removed the instant it ends or is
    // aborted. A non-passive touchmove listener that stays attached for the
    // container's whole lifetime forces the browser to run it synchronously
    // on *every* scroll tick (not just at the top) before it can commit to
    // scrolling, which is what caused the hesitation on ordinary scrolling.
    function endDrag() {
      draggingRef.current = false;
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', endDrag);
      el.removeEventListener('touchcancel', endDrag);
    }

    function onTouchMove(e) {
      if (!draggingRef.current || refreshingRef.current) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        endDrag();
        setPull(0);
        return;
      }
      e.preventDefault();
      // Rubber-band: track the finger 1:1 up to the threshold (so the
      // release point feels immediate/responsive), then damp sharply
      // beyond it, rather than damping the whole drag uniformly.
      const pull = delta < PULL_THRESHOLD ? delta : PULL_THRESHOLD + (delta - PULL_THRESHOLD) * 0.25;
      setPull(Math.min(pull, MAX_PULL));
    }

    function onTouchEnd() {
      const wasDragging = draggingRef.current;
      endDrag();
      if (!wasDragging) return;
      if (pullRef.current >= PULL_THRESHOLD) {
        triggerRefresh();
      } else {
        setSnapping(true);
        setPull(0);
      }
    }

    function onTouchStart(e) {
      if (refreshingRef.current || el.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      draggingRef.current = true;
      setSnapping(false);
      el.addEventListener('touchmove', onTouchMove, { passive: false });
      el.addEventListener('touchend', onTouchEnd, { passive: true });
      el.addEventListener('touchcancel', endDrag, { passive: true });
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      endDrag();
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
