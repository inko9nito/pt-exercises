import { useEffect, useState } from 'react';

// Keeps the screen awake while the app is open, so the phone doesn't lock
// mid-exercise (issue #54): you've got the app propped up doing a rep with
// the dog and the display shouldn't sleep out from under you.
//
// Three mechanisms, picked by context. The web-clip choice is the survivor
// of six on-device rounds on #54 — every alternative below it was tried on
// the actual phone and failed there, so don't "simplify" back to them:
//
//   1. iOS home-screen web clip (navigator.standalone): the aborted-
//      navigation hack (runRefreshHack) — the ONLY thing that held the
//      screen. In the web clip iOS refuses the Wake Lock API outright
//      (NotAllowedError, report #4), ignores hidden video whether muted
//      (report #2) or unmuted with a silent audio track (report #3), and
//      ignores even a VISIBLE unmuted never-ending NoSleep-style video
//      (report #5). The hack held past auto-lock (report #6).
//
//   2. Everywhere else with the standard Screen Wake Lock API: use it.
//      It auto-releases whenever the page is hidden, so it's re-requested
//      on every visibilitychange back to visible — the documented way to
//      hold it across the app's whole lifetime.
//
//   3. Browsers with neither (old iOS Safari, older desktop Firefox):
//      NoSleep.js's video scheme — unmuted (silent audio track), mp4 never
//      loops or ends (timeupdate re-seek), sub-second webm loops. Playback
//      needs one real tap to arm (autoplay policy), which normal app use
//      provides.
//
// The hook returns a short status string ("lock held", "refresh ×3", …)
// that App shows under the build info — six rounds of "did it work on the
// actual device?" is why the answer is visible on the phone itself.
function isIOSStandalone() {
  return typeof navigator !== 'undefined' && navigator.standalone === true;
}

export function useWakeLock() {
  const [status, setStatus] = useState('starting');

  useEffect(() => {
    if (typeof navigator === 'undefined') return undefined;
    if (isIOSStandalone()) return runRefreshHack(setStatus);
    if ('wakeLock' in navigator) return runNativeWakeLock(setStatus);
    return runVideoFallback(setStatus);
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
  // NOT muted: platforms only count audible-eligible playback toward
  // keeping the screen on. The mp4's audio track is silent, so nothing is
  // actually audible.
  video.setAttribute('playsinline', '');
  video.setAttribute('title', 'keep-awake');
  // Rendered as a small visible chip (bottom-left, clear of the footer's
  // refresh button, taps pass through) rather than hidden — media
  // heuristics discount video they consider hidden. Only legacy browsers
  // without the Wake Lock API ever see this.
  video.style.cssText =
    'position:fixed;left:10px;' +
    'bottom:calc(var(--nav-height, 66px) + env(safe-area-inset-bottom) + 10px);' +
    'width:44px;height:26px;object-fit:cover;border-radius:6px;' +
    'background:#000;opacity:0.9;box-shadow:0 1px 4px rgba(0,0,0,0.3);' +
    'z-index:100;pointer-events:none;';

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

// The web clip's keep-awake mechanism, and the only one that works there
// (see the header comment for the five failed alternatives). It's the
// pre-Wake-Lock-era trick from NoSleep.js's oldIOS() path: every 15s,
// start a navigation to the current URL and cancel it on the next tick
// with window.stop(). The OS registers the aborted navigation as page
// activity and resets its idle timer. NoSleep gates it to iOS < 10, but
// on-device report #6 confirmed it still holds the screen on current iOS
// web clips — where every modern mechanism is refused or ignored.
//
// Known risks, accepted knowingly (tracked as a follow-up issue): the
// cancelled navigation can abort in-flight fetches (NoSleep's own
// warning), and if window.stop() ever lands late the page actually
// reloads — the tab survives (it's mirrored in ?tab=) but an open
// exercise detail would close.
function runRefreshHack(setStatus) {
  let ticks = 0;
  setStatus('refresh armed');
  const timer = window.setInterval(() => {
    if (document.hidden) return;
    window.location.href = window.location.href.split('#')[0];
    window.setTimeout(() => window.stop(), 0);
    ticks += 1;
    setStatus(`refresh ×${ticks}`);
  }, 15000);
  return () => {
    window.clearInterval(timer);
  };
}
