# 🐾 Domino — PT Exercises

**Your dog's physical-therapy plan, in your pocket.**

Domino turns a rehab vet's stack of printed exercise sheets into a simple,
tap-to-track app you can prop up next to you on the floor while you work
through a session with your dog. It knows what's due today, remembers what
you've done, and keeps every device in the household in sync — so anyone can
pick up the phone and know exactly where things stand.

---

## What it does

Recovering from surgery or an injury means a daily routine of physio
exercises, each with its own sets, reps, and schedule — some every day, some
every other day, some a few times a week. Keeping that straight from a folder
of handouts is hard, and it's harder still when more than one person is
helping. Domino does the remembering for you:

- **Today, sorted for you.** Open the app and see exactly what's due right
  now — nothing more to figure out. Exercises are grouped into what's due,
  what's optional, and what you've already finished.
- **Tap to log.** Mark an exercise done with a single tap. Did an extra
  round? Log it as a bonus. Tapped by mistake? Undo it.
- **Every exercise, illustrated.** Each exercise has a photo walkthrough,
  a plain-language description, sets and reps, how often to do it, and any
  equipment you'll need. Tap a photo to view it full-screen.
- **Look back at any day.** Scroll to a past day to see or fix what was
  logged — handy when you forgot to check something off in the moment.
- **See your progress.** A Week and Month view shows your activity at a
  glance, so you can watch the streak build and spot the days you missed.
- **Stays in sync.** Log a session on one phone and it shows up on every
  other device instantly. No accounts, no setup — just open it.
- **Screen stays awake.** While the app is open the display won't sleep out
  from under you mid-rep.
- **Add it to your home screen.** Installs like a native app, opens
  full-screen, and works the moment you tap the icon.

---

## How it works

Domino is a single-page web app you can add to your phone's home screen — no
app store, no install step beyond "Add to Home Screen."

- **Frontend:** [React](https://react.dev) (hooks, no router — navigation is
  driven straight off the URL so a reload lands you back where you were),
  built and bundled with [Vite](https://vitejs.dev).
- **Sync:** [Firebase Realtime Database](https://firebase.google.com/docs/database).
  Every logged session and daily plan is mirrored to a shared node and
  streamed back down to every open device over a live connection. Writes are
  cached locally first, so the app keeps working with a flaky signal and
  reconciles when it reconnects.
- **Exercise data:** the full plan — names, sets, reps, frequency, photos,
  and descriptions — lives in `src/data/exercises.js`, alongside the images
  in `public/images`.
- **Screen wake:** the standard Screen Wake Lock API where it's reliable,
  with a silent-video fallback for iOS home-screen apps where it isn't.
- **Styling:** hand-written CSS (`src/index.css`) with the Nunito typeface;
  no UI framework.

### Under the hood

| Area | What lives there |
| --- | --- |
| `src/App.jsx` | Top-level state, tab navigation, sync wiring |
| `src/components/` | Today / All / Progress views, exercise detail, sheets, calendar |
| `src/utils/tracker.js` | Completion + plan bookkeeping, scheduling logic |
| `src/utils/sync.js` | Firebase subscribe/push, offline-safe writes |
| `src/utils/progressStats.js` | Week/month rollups for the Progress tab |
| `src/data/exercises.js` | The exercise plan itself |

---

## Running it locally

```bash
npm install     # install dependencies
npm run dev      # start the dev server (Vite)
npm run build    # production build
npm run preview  # preview the production build
npm test         # run the test suite (Vitest)
npm run lint     # lint with ESLint
```

The scheduling, sync-reconciliation, and progress-stat logic are covered by
tests under `src/utils/*.test.js`.

---

*Built with care for one very good dog. 🐕*
