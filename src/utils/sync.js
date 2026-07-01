import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

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
    onChange(snapshot.val() || {});
  });
}

export function pushCompletions(completions) {
  return set(completionsRef, completions);
}
