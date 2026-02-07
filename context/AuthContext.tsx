
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { AuthService, auth, db } from '../services/firebase'; // Import auth instance
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Listen for Authentication State Changes (Persistence)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, fetch their profile from Firestore
        setEmailVerified(firebaseUser.emailVerified);
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({ uid: firebaseUser.uid, ...userDoc.data() } as UserProfile);
          } else {
            console.error("User authenticated but no profile found in Firestore");
            // Optional: Create a default profile if missing?
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
        }
      } else {
        // User is signed out
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    // AuthService.login wraps signInWithEmailAndPassword and fetches profile
    // The onAuthStateChanged listener will also fire, but we can update state here directly for speed
    const profile = await AuthService.login(email, pass);
    setUser(profile);
    if (auth.currentUser) {
      setEmailVerified(auth.currentUser.emailVerified);
    }
  };

  const signup = async (email: string, pass: string) => {
    const profile = await AuthService.register(email, pass);
    setUser(profile);
    if (auth.currentUser) {
      setEmailVerified(auth.currentUser.emailVerified);
    }
  };

  const googleLogin = async () => {
    await AuthService.loginWithGoogle();
    if (auth.currentUser) {
      setEmailVerified(auth.currentUser.emailVerified);
    }
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  const refreshProfile = async () => {
    if (user && auth.currentUser) {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUser({ uid: auth.currentUser.uid, ...userDoc.data() } as UserProfile);
      }
    }
  };

  const reloadUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setEmailVerified(auth.currentUser.emailVerified);
    }
  };

  return (
    <AuthContext.Provider value={{ user, emailVerified, loading, login, signup, googleLogin, logout, refreshProfile, reloadUser, isDemo: false }}>
      {children}
    </AuthContext.Provider>
  );
};
