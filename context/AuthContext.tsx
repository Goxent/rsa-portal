import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { AuthService, auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';

const SESSION_EXPIRY_DAYS = 15;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

interface AuthContextType {
  user: UserProfile | null;
  emailVerified: boolean;
  loading: boolean;
  login: (email: string, pass: string, forceSessionId?: string) => Promise<void>;
  signup: (email: string, pass: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: (reason?: 'MANUAL' | 'SESSION_EXPIRED') => Promise<void>;
  refreshUser: () => Promise<void>;
  reloadUser: () => Promise<void>;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);

  // ── Auth state listener ──────────────────────────────────────────────────
  // Note: inactivity auto-logout is handled exclusively by useAutoLogout hook
  // in components/Layout.tsx — do not add a second timer here.
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous snapshot listener if any
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (firebaseUser) {
        setEmailVerified(firebaseUser.emailVerified);
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const userData = { uid: firebaseUser.uid, ...userDoc.data() } as UserProfile;

            // 1. Initial expiry check (15 days)
            if (userData.sessionCreatedAt) {
              const sessionAge = Date.now() - userData.sessionCreatedAt;
              if (sessionAge > SESSION_EXPIRY_MS) {
                await AuthService.logout('SESSION_EXPIRED');
                setUser(null);
                setLoading(false);
                return;
              }
            }

            setUser(userData);

            // 2. Real-time Session Monitoring
            unsubscribeSnapshot = onSnapshot(userRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data() as UserProfile;
                    // New schema: sessions are keyed by sessionId, not deviceType
                    const localSessionId = localStorage.getItem('sessionId');
                    if (localSessionId) {
                        const sessionExists = data.activeSessions && data.activeSessions[localSessionId];
                        if (!sessionExists) {
                            console.warn('[Security] Session was removed by another login.');
                            toast.error('You have been logged out because your account was signed in on another device.', { duration: 6000, id: 'multi-login' });
                            AuthService.logout('SESSION_TERMINATED').then(() => {
                                setUser(null);
                            });
                        }
                    }
                }
            });

            // 3. Admin background tasks
            if (AuthService.isAdmin(userData.role)) {
                const today = new Date().toISOString().split('T')[0];
                const lastCleanup = AuthService.getLastAuditCleanup();
                if (lastCleanup !== today) {
                    AuthService.cleanupOldAuditLogs().then(() => {
                        AuthService.setLastAuditCleanup(today);
                    }).catch(console.error);
                }
            }
            
            AuthService.cleanupOldNotifications(firebaseUser.uid, AuthService.isAdmin(userData.role)).catch(console.error);
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
        }
      } else {
        setUser(null);
        setEmailVerified(false);
      }
      setLoading(false);
    });

    return () => {
        unsubscribeAuth();
        if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const login = async (email: string, pass: string, forceSessionId?: string) => {
    try {
      const profile = await AuthService.login(email, pass, forceSessionId);
      setUser(profile);
      if (auth.currentUser) {
        setEmailVerified(auth.currentUser.emailVerified);
      }
    } catch (error) {
      console.error('Login error in context:', error);
      throw error; // Re-throw to be handled by the component
    }
  };

  const signup = async (email: string, pass: string) => {
    try {
      const profile = await AuthService.register(email, pass);
      setUser(profile);
      if (auth.currentUser) {
        setEmailVerified(auth.currentUser.emailVerified);
      }
    } catch (error) {
      console.error('Signup error in context:', error);
      throw error; // Re-throw to be handled by the component
    }
  };

  const googleLogin = async () => {
    try {
      const profile = await AuthService.loginWithGoogle();
      setUser(profile);
      if (auth.currentUser) {
        setEmailVerified(auth.currentUser.emailVerified);
      }
    } catch (error) {
      console.error('Google login error in context:', error);
      throw error; // Re-throw to be handled by the component
    }
  };

  const logout = async (reason: 'MANUAL' | 'SESSION_EXPIRED' = 'MANUAL') => {
    try {
      await AuthService.logout(reason);
      setUser(null);
      setEmailVerified(false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    if (user && auth.currentUser) {
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setUser({ uid: auth.currentUser.uid, ...userDoc.data() } as UserProfile);
        }
      } catch (error) {
        console.error('Error refreshing profile:', error);
      }
    }
  };

  const reloadUser = async () => {
    if (auth.currentUser) {
      try {
        await auth.currentUser.reload();
        setEmailVerified(auth.currentUser.emailVerified);
      } catch (error) {
        console.error('Error reloading user:', error);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        emailVerified,
        loading,
        login,
        signup,
        googleLogin,
        logout,
        refreshUser,
        reloadUser,
        isDemo: false
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};