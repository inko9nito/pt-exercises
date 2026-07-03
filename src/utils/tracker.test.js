import { describe, it, expect } from 'vitest';
import { removeSessionOn } from './tracker.js';

// Regression tests for issue #43: the exercise-detail undo action must only
// ever remove a session logged *today* — never reach back and silently
// delete a session from a prior day. `removeSessionOn` is the day-scoped
// helper `handleUndo` now uses instead of the old global `undoLast`.
describe('removeSessionOn (undo semantics)', () => {
  const tuesday = new Date('2026-06-30T12:00:00');
  const today = new Date('2026-07-02T12:00:00');

  it('removes only the target day\'s session, leaving other days untouched', () => {
    const completions = {
      '10': [tuesday.toISOString(), today.toISOString()],
    };
    const next = removeSessionOn(completions, 10, today);
    expect(next['10']).toEqual([tuesday.toISOString()]);
  });

  it('is a no-op when there is no session on the target day', () => {
    const completions = { '10': [tuesday.toISOString()] };
    const next = removeSessionOn(completions, 10, today);
    expect(next).toBe(completions);
    expect(next['10']).toEqual([tuesday.toISOString()]);
  });

  it('removes only the most recent session when the target day has several', () => {
    const first = new Date('2026-07-02T08:00:00').toISOString();
    const second = new Date('2026-07-02T14:00:00').toISOString();
    const completions = { '18': [tuesday.toISOString(), first, second] };
    const next = removeSessionOn(completions, 18, today);
    expect(next['18']).toEqual([tuesday.toISOString(), first]);
  });
});
