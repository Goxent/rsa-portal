import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { AuthService, auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, runTransaction } from 'firebase/firestore';

interface AuthContextType {
  user: UserProfile | null;
  emailVerified: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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
          // Use transaction to prevent race conditions
          await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await transaction.get(userRef);

            if (userDoc.exists()) {
              const userData = { uid: firebaseUser.uid, ...userDoc.data() } as UserProfile;
              setUser(userData);
            } else {
              console.warn("User authenticated but no profile found in Firestore. Waiting for creation or invalid user.");
              // Do NOT create default profile. Rigid security.
            }
          });

          // Cleanup old notifications (non-blocking)
          AuthService.cleanupOldNotifications(firebaseUser.uid).catch(console.error);

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

  const logout = async () => {
    try {
      await AuthService.logout();
      setUser(null);
      setEmailVerified(false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const refreshProfile = async () => {
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
        refreshProfile,
        reloadUser,
        isDemo: false
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};