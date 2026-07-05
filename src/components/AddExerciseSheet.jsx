import { useState, useMemo, useEffect, useRef } from 'react';
import ExerciseRow from './ExerciseRow.jsx';
import { SearchIcon, XIcon } from './Icons.jsx';

// How far the exit slide-down runs before the sheet unmounts. Kept in sync
// with the .sheet transition duration in index.css.
const EXIT_MS = 320;
// Drag distance (px) past which releasing dismisses the sheet.
const DISMISS_THRESHOLD = 100;

export default function AddExerciseSheet({
  exercises,
  completions,
  onOpenExercise,
  onClose,
  title = 'Log another exercise',
}) {
  const [search, setSearch] = useState('');
  // `shown` drives the entrance: it starts false (sheet parked off-screen at
  // translateY(100%)) and flips true on the next frame so the transition to 0
  // plays. `closing` plays the reverse before we actually unmount.
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(null);
  const closeTimer = useRef(null);
  const overlayRef = useRef(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (ex) => ex.name.toLowerCase().includes(q) || ex.description.toLowerCase().includes(q)
    );
  }, [exercises, search]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(id);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Lock the page behind the sheet so touch-scrolling over the sheet doesn't
  // also scroll the Today list underneath (issue #37). The real scroller here
  // is the window (the app column grows past the viewport rather than scrolling
  // an inner element), so freeze it by pinning <body> and restore the exact
  // scroll position on close. The class also caps .app-main as a belt-and-
  // suspenders lock in case an inner element is the scroller instead.
  useEffect(() => {
    const scrollY = window.scrollY;
    const { body } = document;
    body.classList.add('sheet-open');
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    return () => {
      body.classList.remove('sheet-open');
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Belt-and-suspenders for iOS: even with <body> frozen, when the keyboard is
  // up iOS can still pan the page under a touch-drag on the sheet. Block any
  // touch-move that isn't scrolling the results list within its own limits, so
  // dragging the header, search, backdrop, or a non-scrollable list can't drag
  // the sheet around or reveal the page behind it (issue #37).
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const onTouchMove = (e) => {
      const list = e.target.closest?.('.sheet-scroll');
      const canScroll = list && list.scrollHeight > list.clientHeight;
      if (!canScroll) e.preventDefault();
    };
    overlay.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => overlay.removeEventListener('touchmove', onTouchMove);
  }, []);

  // Play the slide-down before unmounting so the sheet leaves the way it
  // arrived, instead of vanishing.
  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setDragging(false);
    closeTimer.current = setTimeout(onClose, EXIT_MS);
  };

  // Swipe-down-to-dismiss. Handlers live on the grip/header only, so dragging
  // there never fights with scrolling the results list below.
  const onPointerDown = (e) => {
    if (closing) return;
    // Don't start a drag (and capture the pointer) when the press lands on the
    // close button — that would swallow its click.
    if (e.target.closest('.sheet-close')) return;
    startY.current = e.clientY;
    setDragging(true);
    // Capture so the drag keeps tracking once the pointer leaves the grip and
    // moves down over the results list — otherwise the gesture freezes and the
    // release never registers.
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (startY.current == null) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  };
  const endDrag = () => {
    if (startY.current == null) return;
    startY.current = null;
    setDragging(false);
    if (dragY > DISMISS_THRESHOLD) handleClose();
    else setDragY(0);
  };

  const parked = closing || !shown;
  const offset = parked ? '100%' : `${dragY}px`;

  return (
    <div
      ref={overlayRef}
      className="sheet-overlay"
      style={{ opacity: parked ? 0 : 1 }}
      onClick={handleClose}
    >
      <div
        className={`sheet ${dragging ? 'is-dragging' : ''}`}
        style={{ transform: `translateY(${offset})` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="sheet-grab"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="sheet-handle" aria-hidden="true" />
          <div className="sheet-header">
            <span className="sheet-title">{title}</span>
            <button className="sheet-close" onClick={handleClose} aria-label="Close">
              <XIcon size={20} />
            </button>
          </div>
        </div>

        {/* Search is pinned outside the scroll region: keeping the input out of
            the scrolling list stops iOS from scroll-jumping the sheet to
            "reveal" it when focused. */}
        <div className="sheet-search">
          <div className="search-wrap">
            <span className="search-icon">
              <SearchIcon size={16} />
            </span>
            <input
              type="search"
              className="search-input"
              placeholder="Search exercises"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="sheet-scroll">
          {filtered.length === 0 ? (
            <p className="empty-state">No exercises match your search.</p>
          ) : (
            <div className="row-group">
              {filtered.map((ex) => (
                <ExerciseRow
                  key={ex.id}
                  exercise={ex}
                  completions={completions}
                  onOpen={onOpenExercise}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
