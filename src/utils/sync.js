import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { normalizeCompletions } from './tracker.js';

const firebaseConfig = {
  apiKey: 'AIzaSyD-CxVuiQ4k94KKixh4y8iPHRxlODCXY24',
  authDomain: 'domino-pt.firebaseapp.com',
  databaseURL: 'https://domino-pt-default-rtdb.firebaseio.com',
  projectId: 'domino-pt',
  storageBucket: 'domino-pt.firebasestorage.app',
  messagingSenderId: '649723955675',
  appId: '1:649723955675:web:4a179dbf7b1200edca7ffe',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const completionsRef = ref(db, 'completions');

export function subscribeToCompletions(onChange) {
  return onValue(completionsRef, (snapshot) => {
    onChange(normalizeCompletions(snapshot.val()));
  });
}

// Writes only the one exercise's session history that actually changed,
// instead of the whole completions tree — logging or undoing one exercise
// used to re-upload every other exercise's full history too on every single
// action. Firebase's onValue on the parent `completions` path still sees the
// merged, up-to-date full tree regardless of which descendant path a write
// lands on, so this doesn't change anything about how subscribeToCompletions
// receives updates.
export function pushExerciseCompletions(exerciseId, history) {
  return set(ref(db, `completions/${exerciseId}`), history);
}
