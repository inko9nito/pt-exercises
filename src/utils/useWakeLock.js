import { useEffect } from 'react';

// Keeps the screen awake while the app is open, so the phone doesn't lock
// mid-exercise (issue #54): you've got the app propped up doing a rep with
// the dog and the display shouldn't sleep out from under you.
//
// Two different mechanisms are used depending on context:
//
//   1. The standard Screen Wake Lock API, everywhere it's actually
//      trustworthy. It isn't everywhere: it's absent on older iOS
//      (pre-16.4) and desktop Firefox, so it's feature-guarded and a
//      missing API just no-ops. It also gets auto-released by the browser
//      whenever the page stops being visible, so it's re-requested on every
//      visibilitychange back to visible — the documented way to hold it
//      across the app's whole lifetime.
//
//   2. A silent, looping, invisible video, forced specifically for iOS's
//      home-screen "web clip" apps (navigator.standalone). That's not a
//      guess: #54 was verified fixed in a regular Safari tab but the screen
//      still locked in the installed home-screen app, which matches a
//      known WebKit gap — the Wake Lock API can resolve successfully there
//      without actually stopping the OS's auto-lock timer. Playing muted
//      video is the older, pre-Wake-Lock-API trick (what NoSleep.js has
//      always relied on) and isn't subject to that bug, so it's used as the
//      forced path in standalone mode rather than as a try/catch fallback
//      to the same broken API. Video playback needs a user gesture the
//      first time, which the app has plenty of (marking exercises done,
//      switching tabs, etc.) — see runVideoFallback.
function isIOSStandalone() {
  return typeof navigator !== 'undefined' && navigator.standalone === true;
}

export function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === 'undefined') return undefined;
    if (isIOSStandalone() || !('wakeLock' in navigator)) {
      return runVideoFallback();
    }
    return runNativeWakeLock();
  }, []);
}

function runNativeWakeLock() {
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
}

function runVideoFallback() {
  const video = document.createElement('video');
  video.muted = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('title', 'keep-awake (silent, not displayed)');

  const base = import.meta.env.BASE_URL;
  for (const [file, type] of [
    ['nosleep.webm', 'video/webm'],
    ['nosleep.mp4', 'video/mp4'],
  ]) {
    const source = document.createElement('source');
    source.src = `${base}${file}`;
    source.type = type;
    video.appendChild(source);
  }
  video.loop = true;
  video.load();

  let cancelled = false;
  const play = () => {
    if (cancelled) return;
    // Ignored on purpose: the first call typically fails until a user
    // gesture arrives (handled below), and there's nothing actionable to
    // show the user if the browser blocks it entirely.
    video.play().catch(() => {});
  };

  // Autoplay policies block the first play() until a real user gesture —
  // the app has plenty of taps, so just retry on the next one. Left
  // attached (rather than removed after first success) so playback also
  // recovers if the OS pauses it for some other reason.
  document.addEventListener('pointerdown', play);
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') play();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  play();

  return () => {
    cancelled = true;
    document.removeEventListener('pointerdown', play);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    video.pause();
  };
}
