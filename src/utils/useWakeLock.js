import { useEffect } from 'react';

// Keeps the screen awake while the app is open, so the phone doesn't lock
// mid-exercise (issue #54): you've got the app propped up doing a rep with
// the dog and the display shouldn't sleep out from under you.
//
// Two things make this less trivial than "request a lock once":
//   1. The Screen Wake Lock API isn't everywhere. It's absent on older iOS
//      (pre-16.4) and desktop Firefox, so every call is guarded and a missing
//      API just no-ops rather than throwing — the app still works, the screen
//      just behaves normally.
//   2. The browser *automatically releases* the lock whenever the page stops
//      being visible — switching tabs/apps, or the screen turning off before
//      the lock was in place. Coming back to a released lock leaves the screen
//      free to sleep again, so we re-acquire on every visibilitychange back
//      to visible. That's the documented way to hold a wake lock across the
//      app's whole lifetime, not a workaround.
export function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel = null;
    // Set once we've torn down, so an in-flight request() that resolves after
    // cleanup releases immediately instead of re-locking a screen we no longer
    // want held.
    let cancelled = false;

    const acquire = async () => {
      // Requesting a wake lock throws (NotAllowedError) if the document isn't
      // visible, so there's no point trying while hidden — visibilitychange
      // will call us again when we come back.
      if (sentinel || document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          sentinel.release().catch(() => {});
          sentinel = null;
          return;
        }
        // The OS can drop the lock on its own (e.g. low battery); clear our
        // handle so the next visibility change is free to re-acquire.
        sentinel.addEventListener('release', () => {
          sentinel = null;
        });
      } catch {
        // Denied or interrupted — leave the screen to its normal timeout
        // rather than surfacing an error the user can't act on.
        sentinel = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (sentinel) {
        sentinel.release().catch(() => {});
        sentinel = null;
      }
    };
  }, []);
}
