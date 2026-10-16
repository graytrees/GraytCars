// Project settings. These identify Nathan's Firebase project; they are not secrets.
// Access is controlled by the Firestore security rules (firestore.rules), which only
// allow the owner's Google account to read or write anything.
export const firebaseConfig = {
  apiKey: 'PASTE',
  authDomain: 'graytcars.firebaseapp.com',
  projectId: 'graytcars',
  storageBucket: 'graytcars.firebasestorage.app',
  messagingSenderId: 'PASTE',
  appId: 'PASTE',
};

// Google Drive access (weekly backups) reuses the GraytTrees sign-in client, which
// Nathan has already approved. Same Google account, narrow drive.file permission.
export const googleClientId = '924620275504-d1mmgh0mbdln19043n0t7b8trvel38m6.apps.googleusercontent.com';

// The only Google account allowed in. Matches firestore.rules.
export const ownerEmail = 'graytshotz@gmail.com';

// Folder created in the owner's Google Drive.
export const driveFolderName = 'GraytCars';
