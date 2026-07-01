import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, get, set } from 'firebase/database';

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
const connectedRef = ref(db, '.info/connected');

export function subscribeToCompletions(onChange) {
  return onValue(completionsRef, (snapshot) => {
    onChange(snapshot.val() || {});
  });
}

// ".info/connected" is a special server-maintained path Firebase updates
// itself — true only once the client has an actual live connection to the
// server, unlike the completions listener above, which can fire from a
// local/offline snapshot and doesn't by itself prove anything reached
// the server.
export function subscribeToConnectionStatus(onChange) {
  return onValue(connectedRef, (snapshot) => {
    onChange(snapshot.val() === true);
  });
}

export function pushCompletions(completions) {
  return set(completionsRef, completions);
}

// One-shot read for pull-to-refresh — the live subscription already keeps
// completions current, but a manual pull should force a fresh fetch rather
// than just replaying whatever the socket last delivered.
export async function fetchCompletionsOnce() {
  const snapshot = await get(completionsRef);
  return snapshot.val() || {};
}
