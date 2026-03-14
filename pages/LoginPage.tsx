import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck, User, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  // Rate Limiting Logic
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

  const checkRateLimit = () => {
    const stored = localStorage.getItem('rsa_login_attempts');
    if (!stored) return true;

    const { count, firstAttempt } = JSON.parse(stored);
    const now = Date.now();

    if (now - firstAttempt > LOCKOUT_TIME) {
      localStorage.removeItem('rsa_login_attempts');
      return true;
    }

    if (count >= MAX_ATTEMPTS) {
      const remainingTime = Math.ceil((LOCKOUT_TIME - (now - firstAttempt)) / 60000);
      setRateLimitError(`Too many failed attempts. Please try again in ${remainingTime} minutes.`);
      return false;
    }

    return true;
  };

  const recordAttempt = () => {
    const stored = localStorage.getItem('rsa_login_attempts');
    const now = Date.now();

    if (stored) {
      const { count, firstAttempt } = JSON.parse(stored);
      localStorage.setItem('rsa_login_attempts', JSON.stringify({ count: count + 1, firstAttempt }));
    } else {
      localStorage.setItem('rsa_login_attempts', JSON.stringify({ count: 1, firstAttempt: now }));
    }
  };

  const clearAttempts = () => {
    localStorage.removeItem('rsa_login_attempts');
    setRateLimitError(null);
  };

  const [loading, setLoading] = useState(false);
  const { login, googleLogin, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        if (!checkRateLimit()) {
          setLoading(false);
          return;
        }

        // LOGIN LOGIC
        try {
          await login(email, password);
          clearAttempts();
          navigate('/dashboard');
          toast.success('Welcome back!');
        } catch (error) {
          recordAttempt();
          throw error;
        }
      } else {
        // SIGNUP LOGIC
        if (password !== confirmPassword) {
          throw new Error("Passwords must match");
        }
        await signup(email, password);
        navigate('/dashboard');
        toast.success('Account created successfully!');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await googleLogin();
      navigate('/dashboard');
      toast.success('Welcome back!');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0f172a]">
      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
        <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] bg-cyan-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-500">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-2xl shadow-blue-500/30 mb-6 rotate-3 hover:rotate-6 transition-transform duration-500 group">
            <ShieldCheck size={40} className="text-white group-hover:scale-110 transition-transform" />
          </div>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 tracking-tight mb-2">
            RSA Portal
          </h1>
          <p className="text-gray-400 font-medium">Secure Access for Staff</p>
        </div>

        {/* Main Card */}
        <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl relative overflow-hidden">

          {/* Toggle Switch */}
          <div className="flex p-1 bg-black/20 rounded-xl mb-8 border border-white/5 relative">
            <div
              className="absolute bg-white/10 rounded-lg inset-y-1 w-[calc(50%-4px)] transition-all duration-300 ease-out shadow-lg border border-white/10"
              style={{ left: isLogin ? '4px' : 'calc(50%)' }}
            ></div>
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 text-sm font-bold text-center z-10 transition-colors ${isLogin ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 text-sm font-bold text-center z-10 transition-colors ${!isLogin ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
            >
              Sign Up
            </button>
          </div>

          {rateLimitError && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 animate-pulse">
              <Lock className="text-red-400" size={20} />
              <p className="text-sm text-red-300 font-bold">{rateLimitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                <input
                  type="email"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  placeholder="your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                {isLogin && (
                  <Link to="/forgot-password" className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
                    Forgot?
                  </Link>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                <input
                  type="password"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Confirm Password</label>
                <div className="relative group">
                  <Check className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                  <input
                    type="password"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex items-start gap-2">
                <AlertCircle size={16} className="text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-200">
                  Only emails added to the Staff Directory by an Administrator can register.<br />
                  If you need access, contact your manager or admin.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!rateLimitError}
              className={`w-full font-bold py-4 rounded-xl shadow-lg transform transition-all active:scale-[0.98] flex items-center justify-center group ${!!rateLimitError ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-500/20 text-white'}`}
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-white/10"></div>
            <span className="px-4 text-xs font-bold text-gray-500 uppercase">Or continue with</span>
            <div className="flex-1 border-t border-white/10"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white text-gray-900 font-bold py-3.5 rounded-xl shadow-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-400">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-400 font-bold hover:text-blue-300 transition-colors"
            >
              {isLogin ? 'Apply for Access' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;