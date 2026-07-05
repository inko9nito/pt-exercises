import { useRef, useState } from 'react';

const AXIS_LOCK_PX = 8;
const SWIPE_THRESHOLD = 40;
const EDGE_RESISTANCE = 0.35;
const SNAP_TRANSITION = 'transform .32s cubic-bezier(0.22, 0.61, 0.36, 1)';

// Turns "swipe to change week" into a sliding animation instead of an
// instant content swap (issue #84) — the same drag-follows-finger,
// snap-on-release feel as the exercise image carousel. The caller renders a
// 3-wide track (previous/current/next week); this hook only drives the
// track's transform. Once a swipe commits, the outgoing week has fully
// slid out of view before `onWeekChange` fires and the track resets to
// center with no transition, so the swap itself is never visible.
export function useWeekSwipeTrack(weekOffset, onWeekChange, canGoNext = true) {
  const [dragX, setDragX] = useState(0);
  const [trackIndex, setTrackIndex] = useState(1); // 0 = prev, 1 = current, 2 = next
  const [animating, setAnimating] = useState(false);
  const gesture = useRef(null);
  const pendingCommit = useRef(null);

  const onPointerDown = (e) => {
    if (pendingCommit.current) return; // ignore new gestures mid-swap
    // Without this, a drag that carries the pointer past the strip's own
    // edge (very plausible for an edge-to-edge swipe) hands pointerup to
    // whatever element happens to sit under the cursor at release — often
    // outside this subtree entirely, so it never bubbles back to us and the
    // gesture gets stuck mid-slide forever.
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { startX: e.clientX, startY: e.clientY, axis: null, dx: 0 };
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.axis && (Math.abs(dx) > AXIS_LOCK_PX || Math.abs(dy) > AXIS_LOCK_PX)) {
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (g.axis === 'x') {
      // Rubber-band instead of a dead stop when swiping past the allowed edge.
      const blockedNext = dx < 0 && !canGoNext;
      setDragX(blockedNext ? dx * EDGE_RESISTANCE : dx);
    }
    g.dx = dx;
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.axis !== 'x') return;
    setAnimating(true);
    if (g.dx <= -SWIPE_THRESHOLD && canGoNext) {
      pendingCommit.current = 1;
      setDragX(0);
      setTrackIndex(2);
    } else if (g.dx >= SWIPE_THRESHOLD) {
      pendingCommit.current = -1;
      setDragX(0);
      setTrackIndex(0);
    } else {
      setDragX(0);
    }
  };

  const onTransitionEnd = () => {
    setAnimating(false);
    const commit = pendingCommit.current;
    if (!commit) return;
    pendingCommit.current = null;
    onWeekChange(weekOffset + commit);
    setTrackIndex(1);
  };

  return {
    trackProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
    trackStyle: {
      transform: `translateX(calc(${-trackIndex * 100}% + ${dragX}px))`,
      transition: animating ? SNAP_TRANSITION : 'none',
    },
    onTransitionEnd,
  };
}
