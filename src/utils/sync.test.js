import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// The pending-write safeguard (#68 #2) and loadCompletions both use
// localStorage, which the node test env doesn't provide — shim it in memory.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const PENDING_KEY = 'domino_pending_writes';
const COMPLETIONS_KEY = 'domino_completions';
const readPending = () => JSON.parse(store.get(PENDING_KEY) || '[]');

const { pushExerciseCompletions, replayPendingWrites } = await import('./sync.js');

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

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

  it('marks the write pending before it acks, and clears it once resolved', async () => {
    const p = pushExerciseCompletions(5, ['2026-07-01T10:00:00.000Z']);
    // Marked synchronously, before the mocked set() resolves.
    expect(readPending()).toContain('5');
    await p;
    // Cleared once the write is acknowledged.
    expect(readPending()).not.toContain('5');
  });

  it('leaves the write pending if the set() rejects', async () => {
    setMock.mockReturnValueOnce(Promise.reject(new Error('offline')));
    await pushExerciseCompletions(7, ['2026-07-01T10:00:00.000Z']);
    expect(readPending()).toContain('7');
  });
});

describe('replayPendingWrites', () => {
  it('re-pushes each pending exercise from the local cache', () => {
    const hist = ['2026-07-01T10:00:00.000Z'];
    store.set(COMPLETIONS_KEY, JSON.stringify({ 7: hist, 9: [] }));
    store.set(PENDING_KEY, JSON.stringify(['7']));

    replayPendingWrites();

    // Only the pending id (7) is re-pushed, with its local history.
    expect(setMock).toHaveBeenCalledWith({ path: 'completions/7' }, hist);
    expect(refMock).not.toHaveBeenCalledWith(expect.anything(), 'completions/9');
  });

  it('does nothing when there are no pending writes', () => {
    replayPendingWrites();
    expect(setMock).not.toHaveBeenCalled();
  });
});
