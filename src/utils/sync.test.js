import { describe, it, expect, vi } from 'vitest';

// Firebase itself is mocked out entirely — this just verifies the actual
// point of #41's B6 (scoped writes): pushExerciseCompletions must write to
// the one exercise's own path, not re-upload the whole completions tree.
const { refMock, setMock } = vi.hoisted(() => ({
  refMock: vi.fn((_db, path) => ({ path })),
  setMock: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: refMock,
  set: setMock,
  onValue: vi.fn(),
}));

const { pushExerciseCompletions } = await import('./sync.js');

describe('pushExerciseCompletions', () => {
  it('writes to the scoped completions/{id} path, not the whole tree', () => {
    const history = ['2026-07-01T10:00:00.000Z'];
    pushExerciseCompletions(5, history);
    expect(refMock).toHaveBeenCalledWith(expect.anything(), 'completions/5');
    expect(setMock).toHaveBeenCalledWith({ path: 'completions/5' }, history);
  });

  it('scopes to a different exercise\'s path for a different id', () => {
    pushExerciseCompletions(18, []);
    expect(refMock).toHaveBeenCalledWith(expect.anything(), 'completions/18');
  });
});
