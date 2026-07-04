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
// does use loop, matching NoSleep.
//
// Just as deliberately, the video is NOT muted — that was issue #54's
// *third* report: "video playing" in the footer and the screen still
// locked. iOS only counts *audible-eligible* playback toward keeping the
// screen on; a muted video is decorative no matter how it loops. NoSleep
// never mutes, and its mp4 carries a silent audio track precisely so
// unmuted playback registers as real media while producing no sound.
// Unmuted play() can't start without a user gesture anywhere, so the
// first tap in the app (marking an exercise, switching tabs) is what
// arms it — see the pointerdown listener in runVideoFallback.
//
// And the video is VISIBLE — a small floating chip above the bottom nav —
// not a 1×1 transparent pixel. Fourth report: unmuted playback, footer
// confirming "video playing", screen locked anyway. The remaining
// difference between us and playback iOS respects was visibility: iOS's
// media heuristics discount video it considers hidden (offscreen,
// zero-ish size, opacity 0 — exactly how the chip was styled before).
// The chip stays on top of everything, including the exercise detail
// view, since mid-exercise is precisely when the screen must stay on.
//
// The hook returns a short status string ("lock held", "video playing",
// …) that App surfaces next to the build info in the footer — issue #54
// took several rounds of "did it work on the actual device?" and this
// makes the answer visible on the phone itself instead of inferred. In
// the web-clip case all three mechanisms run at once and every status is
// shown.
//
// DO NOT "simplify" the web clip down to a subset of the three. This
// exact all-three configuration is the only one that has ever held the
// screen on a real device (on-device report #6). Report #7 tried the
// obvious cleanup — the aborted-navigation refresh hack alone, since the
// lock is refused and video-only rounds all failed — and the screen went
// back to sleeping. The mechanisms are not independent: the plausible
// reading is that the periodic aborted navigation only registers as
// activity while unmuted media playback is also live, but whatever the
// mechanism, the combination is load-bearing and each piece alone is
// proven insufficient (reports #2–#5 and #7).
function isIOSStandalone() {
  return typeof navigator !== 'undefined' && navigator.standalone === true;
}

// The contexts where keep-awake leans on the video (web clip, or any browser
// without the native Wake Lock API) and so needs one real tap to start —
// exactly the else branch of useWakeLock's effect. Computed up front so
// needsTap can start correct without a synchronous setState in the effect.
function needsGestureContext() {
  return (
    typeof navigator !== 'undefined' &&
    (isIOSStandalone() || !('wakeLock' in navigator))
  );
}

// Returns { status, needsTap }:
//   status   — the detailed diagnostic string (footer, behind ?debug).
//   needsTap — true only when keep-awake is waiting on a user gesture it
//              can't fake: the video path needs one real tap to start
//              (autoplay policy), and until it does the screen isn't held.
//              Drives the "tap to keep the screen on" hint (issue #68 #4).
//              Always false in the native-lock path — nothing to tap there.
// needsTap is derived purely from the video's existing playing/pause
// events; it observes the keep-awake machinery, it does not change it.
export function useWakeLock() {
  const [status, setStatus] = useState('starting');
  // Starts true in the gesture-required contexts; the video's playing/pause
  // events flip it via onActive below. Initialized here (not set in the
  // effect) so there's no synchronous setState in the effect body.
  const [needsTap, setNeedsTap] = useState(needsGestureContext);

  useEffect(() => {
    if (typeof navigator === 'undefined') return undefined;

    const hasNative = 'wakeLock' in navigator;
    if (!isIOSStandalone() && hasNative) {
      return runNativeWakeLock(setStatus);
    }

    // iOS web clip (or no native API at all): every mechanism runs at once
    // and every status is shown — five rounds in, the footer readout is the
    // only ground truth we get from the device, so nothing runs silently.
    // The native lock is requested even though the web clip refuses it
    // (NotAllowedError, per on-device report #4) purely so the refusal
    // stays visible; the video is the NoSleep-style path; the refresh hack
    // is the last untried trick from the pre-Wake-Lock era (see
    // runRefreshHack).
    const parts = { video: '…', lock: hasNative ? '…' : null, refresh: '…' };
    const compose = () => {
      setStatus(
        [parts.video, parts.lock, parts.refresh].filter(Boolean).join(' · ')
      );
    };
    const stopVideo = runVideoFallback(
      (s) => {
        parts.video = s;
        compose();
      },
      (active) => setNeedsTap(!active)
    );
    const stopLock = hasNative
      ? runNativeWakeLock((s) => {
          parts.lock = s;
          compose();
        })
      : null;
    const stopRefresh = runRefreshHack((s) => {
      parts.refresh = s;
      compose();
    });
    return () => {
      stopVideo();
      if (stopLock) stopLock();
      stopRefresh();
    };
  }, []);

  return { status, needsTap };
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

// `onActive(bool)` is an optional observer of whether the video is actually
// playing (armed). It only reports state for the UI's tap hint; it never
// gates or alters playback. Defaults to a no-op so the keep-awake path is
// identical whether or not anyone's watching.
function runVideoFallback(setStatus, onActive = () => {}) {
  const video = document.createElement('video');
  // NOT muted — see the header comment. The mp4's audio track is silent,
  // so nothing is audible; unmuted is what makes iOS count the playback.
  video.setAttribute('playsinline', '');
  video.setAttribute('title', 'keep-awake');
  // Visible on purpose — see the header comment. Rendered as a 1px-tall
  // hairline spanning the full width, sitting at the seam just above the
  // bottom nav (issue #72), so the playback iOS requires reads as the app's
  // own divider rather than a black box. Still genuinely on-screen and
  // opaque — NOT hidden/zero-size/opacity-0, which #54 proved iOS ignores.
  //
  // The source video is solid black, so `invert(1) brightness(0.9)` repaints
  // it to ~#E6E6E6, matching the divider colour sampled from the app
  // (--border, #E5E1D6). filter only affects paint — size, opacity and
  // playback are unchanged, so it doesn't touch what iOS counts for
  // keep-awake. If a 1px line ever turns out too small for iOS to count
  // (screen sleeps again), increasing the height is the one knob.
  // pointer-events:none so it never eats a tap.
  video.style.cssText =
    'position:fixed;left:0;right:0;' +
    'bottom:calc(var(--nav-height, 66px) + env(safe-area-inset-bottom));' +
    'width:100%;height:1px;object-fit:cover;' +
    'filter:invert(1) brightness(0.9);' +
    'opacity:0.9;z-index:100;pointer-events:none;';

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

  video.addEventListener('playing', () => {
    setStatus('video playing');
    onActive(true);
  });
  video.addEventListener('pause', () => {
    setStatus('video paused');
    onActive(false);
  });
  video.addEventListener('error', () => {
    setStatus('video error');
    onActive(false);
  });
  setStatus('video waiting for tap');
  onActive(false);

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

// The pre-Wake-Lock-era trick (NoSleep.js's oldIOS() path, and the top
// answers on the classic StackOverflow thread about iOS 7): every 15s,
// start a navigation to the current URL and cancel it on the next tick
// with window.stop(). The OS registers the aborted navigation as page
// activity and resets its idle timer. NoSleep gates this to iOS < 10, but
// after five failed rounds on #54 (wake lock refused, hidden video
// ignored, muted video ignored, visible unmuted video ignored) it's the
// last web-available mechanism left untried in the web clip, so it runs
// alongside the others rather than being ruled out on age.
//
// Known risks, accepted for now: the cancelled navigation can abort
// in-flight fetches (NoSleep's own warning), and if window.stop() ever
// lands late the page would actually reload — the tab would survive (it's
// mirrored in ?tab=) but an open exercise detail would close. If this
// turns out to be the mechanism that finally works, tightening those
// edges becomes the follow-up.
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
