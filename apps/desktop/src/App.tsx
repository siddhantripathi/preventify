import { useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User
} from 'firebase/auth';
import { auth, syncUserWithBackend, UserProfile } from './firebase';

type HealthStatus = 'idle' | 'checking' | 'ok' | 'error';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<HealthStatus>('idle');
  const [healthMessage, setHealthMessage] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const userProfile = await syncUserWithBackend(currentUser);
          setProfile(userProfile);
        } catch (error) {
          console.error('Failed to sync user with backend:', error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000',
    []
  );

  useEffect(() => {
    const runHealthCheck = async () => {
      setStatus('checking');
      try {
        const response = await fetch(`${apiBaseUrl}/health`);
        if (!response.ok) {
          throw new Error(`Health check failed (${response.status})`);
        }
        const data = (await response.json()) as { status: string };
        setStatus(data.status === 'ok' ? 'ok' : 'error');
        setHealthMessage(JSON.stringify(data));
      } catch (error) {
        setStatus('error');
        setHealthMessage(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    runHealthCheck();
  }, [apiBaseUrl]);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google sign-in failed');
    }
  };

  const handleEmailSignUp = async () => {
    setAuthError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Email sign-up failed');
    }
  };

  const handleEmailSignIn = async () => {
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Email sign-in failed');
    }
  };

  const handleSignOut = async () => {
    setAuthError('');
    try {
      await signOut(auth);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign out failed');
    }
  };

  if (authLoading) {
    return <div style={{ fontFamily: 'Arial, sans-serif', padding: 24 }}>Loading...</div>;
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 24, maxWidth: 720 }}>
      <h1>Preventify Desktop</h1>

      <section>
        <h2>Backend Status</h2>
        <p>Status: {status}</p>
        <p>{healthMessage}</p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Authentication</h2>

        {user ? (
          <div>
            <p>Signed in as: <strong>{user.email ?? user.displayName ?? user.uid}</strong></p>
            {profile && <p>Role: <strong style={{ textTransform: 'capitalize' }}>{profile.role}</strong></p>}
            {user.photoURL && <img src={user.photoURL} alt="avatar" style={{ width: 48, borderRadius: '50%' }} />}
            <div style={{ marginTop: 12 }}>
              <button onClick={handleSignOut}>Sign out</button>
            </div>
          </div>
        ) : (
          <>
            <button onClick={handleGoogleSignIn}>Sign in with Google</button>

            <div style={{ marginTop: 16 }}>
              <div>
                <label>
                  Email
                  <input
                    style={{ marginLeft: 8 }}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    placeholder="you@example.com"
                  />
                </label>
              </div>
              <div style={{ marginTop: 8 }}>
                <label>
                  Password
                  <input
                    style={{ marginLeft: 8 }}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    placeholder="password"
                  />
                </label>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button onClick={handleEmailSignUp}>Create account</button>
                <button onClick={handleEmailSignIn}>Sign in</button>
              </div>
            </div>
          </>
        )}

        {authError ? <p style={{ color: 'crimson' }}>{authError}</p> : null}
      </section>
    </div>
  );
}

