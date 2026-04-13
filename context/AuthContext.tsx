import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { AuthService, auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const SESSION_EXPIRY_DAYS = 15;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

interface AuthContextType {
  user: UserProfile | null;
  emailVerified: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, fetch their profile from Firestore
        setEmailVerified(firebaseUser.emailVerified);
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const userData = { uid: firebaseUser.uid, ...userDoc.data() } as UserProfile;

            // Enforce 15-day session limit
            if (userData.sessionCreatedAt) {
                const sessionAge = Date.now() - userData.sessionCreatedAt;
                if (sessionAge > SESSION_EXPIRY_MS) {
                    console.warn(`[Security] Session expired (Age: ${Math.round(sessionAge / 3600000)}h). Logging out.`);
                    toast.error('Your session has expired for security reasons. Please login again.', { duration: 5000, id: 'session-expired' });
                    await AuthService.logout('SESSION_EXPIRED');
                    setUser(null);
                    setLoading(false);
                    return;
                }
            }

            setUser(userData);
            
            // Check if admin to perform background tasks
            if (AuthService.isAdmin(userData.role)) {
                // Background task: Audit Log Cleanup (Throttled to once per day)
                const today = new Date().toISOString().split('T')[0];
                const lastCleanup = AuthService.getLastAuditCleanup();
                
                if (lastCleanup !== today) {
                    AuthService.cleanupOldAuditLogs().then(() => {
                        AuthService.setLastAuditCleanup(today);
                    }).catch(console.error);
                }
            }
            
          } else {
            console.warn('User authenticated but no profile found in Firestore. Waiting for creation or invalid user.');
            // Do NOT create default profile. Rigid security.
          }

          // Cleanup old notifications (non-blocking)
          AuthService.cleanupOldNotifications(firebaseUser.uid, AuthService.isAdmin(userData.role)).catch(console.error);

        } catch (err) {
          console.error("Error fetching/creating user profile:", err);
        }
      } else {
        // User is signed out
        setUser(null);
        setEmailVerified(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const profile = await AuthService.login(email, pass);
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