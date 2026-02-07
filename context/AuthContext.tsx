
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { AuthService } from '../services/firebase';

interface AuthContextType {
  user: UserProfile | null;
  emailVerified: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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
  const [emailVerified, setEmailVerified] = useState(true); // Always true for prototype
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initial Load - Check Local Storage for Mock Session
    const loadSession = async () => {
        try {
            const sessionStr = localStorage.getItem('rsa_mock_session');
            if (sessionStr) {
                const userData = JSON.parse(sessionStr);
                // Ensure profile is up to date with "DB"
                const freshProfile = await AuthService.syncUserProfile(userData);
                setUser(freshProfile);
            }
        } catch (e) {
            console.error("Session load failed", e);
        } finally {
            setLoading(false);
        }
    };
    loadSession();
  }, []);

  const login = async (email: string, pass: string) => {
    const user = await AuthService.login(email, pass);
    setUser(user);
    setEmailVerified(true);
  };

  const signup = async (email: string, pass: string) => {
    const user = await AuthService.register(email, pass);
    setUser(user); // Auto login on signup for prototype
    setEmailVerified(true);
  };

  const googleLogin = async () => {
    const user = await AuthService.loginWithGoogle();
    setUser(user);
    setEmailVerified(true);
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  const refreshProfile = async () => {
    if (user) {
       const profile = await AuthService.syncUserProfile(user);
       setUser(profile);
    }
  };

  return (
    <AuthContext.Provider value={{ user, emailVerified, loading, login, signup, googleLogin, logout, refreshProfile, isDemo: true }}>
      {children}
    </AuthContext.Provider>
  );
};
