import { useEffect, useState } from 'react';

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
//   2. A silent, invisible video, forced specifically for iOS's
//      home-screen "web clip" apps (navigator.standalone). That's not a
//      guess: #54 was verified fixed in a regular Safari tab but the screen
//      still locked in the installed home-screen app, which matches a
//      known WebKit gap — the Wake Lock API can resolve successfully there
//      without actually stopping the OS's auto-lock timer.
//
// The video path deliberately copies NoSleep.js's playback scheme instead
// of a plain <video loop>: iOS treats a short video on a loop as ignorable
// and lets the screen sleep anyway (the first cut of this fallback looped,
// and the web clip's screen still locked — issue #54's second report).
// NoSleep's trick is to never let the mp4 loop or end: every timeupdate
// past the 0.5s mark seeks back to a random early position, so as far as
// the OS is concerned one continuous video has been playing the whole
// time. The sub-second webm (for non-iOS browsers without the native API)
// does use loop, matching NoSleep. Playback also needs one real tap to
// start (autoplay policy), which the app's normal use provides.
//
// The hook returns a short status string ("lock held", "video playing",
// …) that App surfaces next to the build info in the footer — issue #54
// took several rounds of "did it work on the actual device?" and this
// makes the answer visible on the phone itself instead of inferred.
function isIOSStandalone() {
  return typeof navigator !== 'undefined' && navigator.standalone === true;
}

export function useWakeLock() {
  const [status, setStatus] = useState('starting');

  useEffect(() => {
    if (typeof navigator === 'undefined') return undefined;
    if (isIOSStandalone() || !('wakeLock' in navigator)) {
      return runVideoFallback(setStatus);
    }
    return runNativeWakeLock(setStatus);
  }, []);

  return status;
}

function runNativeWakeLock(setStatus) {
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
      setStatus('lock held');
      // The OS can drop the lock on its own (e.g. low battery); clear our
      // handle so the next visibility change is free to re-acquire.
      sentinel.addEventListener('release', () => {
        sentinel = null;
        if (!cancelled) setStatus('lock dropped');
      });
    } catch (err) {
      // Denied or interrupted — leave the screen to its normal timeout
      // rather than surfacing an error the user can't act on.
      sentinel = null;
      setStatus(`lock failed (${err?.name || 'error'})`);
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

function runVideoFallback(setStatus) {
  const video = document.createElement('video');
  video.muted = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('title', 'keep-awake (silent, not displayed)');
  // Kept in the DOM (newer iOS is pickier about off-document media), but
  // invisible and inert. Not display:none — that can suspend playback.
  video.style.cssText =
    'position:fixed;left:-1px;top:auto;width:1px;height:1px;opacity:0;pointer-events:none;';

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

  // NoSleep.js's scheme, on which the whole fallback is modeled: the
  // sub-second webm can loop, but the mp4 (what iOS actually plays) must
  // never loop or end — see the header comment. duration <= 1 tells the
  // two apart without caring which source the browser picked.
  video.addEventListener('loadedmetadata', () => {
    if (video.duration <= 1) {
      video.setAttribute('loop', '');
    } else {
      video.addEventListener('timeupdate', () => {
        if (video.currentTime > 0.5) video.currentTime = Math.random();
      });
    }
  });

  video.addEventListener('playing', () => setStatus('video playing'));
  video.addEventListener('pause', () => setStatus('video paused'));
  video.addEventListener('error', () => setStatus('video error'));
  setStatus('video waiting for tap');

  document.body.appendChild(video);

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
    video.remove();
  };
}
