import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'doctor' | 'nurse' | 'admin';
  createdAt: string;
  lastLoginAt: string;
  isActive: boolean;
}

export async function syncUserWithBackend(user: User): Promise<UserProfile> {
  const token = await user.getIdToken();

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    })
  });

  if (!response.ok) {
    throw new Error('Failed to sync user with backend');
  }

  const data = (await response.json()) as { user: UserProfile };
  return data.user;
}

export async function getCurrentUserProfile(user: User): Promise<UserProfile> {
  const token = await user.getIdToken();

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get user profile');
  }

  const data = (await response.json()) as { user: UserProfile };
  return data.user;
}

