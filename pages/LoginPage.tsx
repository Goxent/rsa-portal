import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormValues } from '../utils/validationSchemas';
// @ts-ignore
import NepaliDate from 'nepali-date-converter';

const getNepaliDate = () => {
  try {
    const nd = new NepaliDate(new Date());
    return nd.format('DD MMMM YYYY') + ' BS';
  } catch {
    return '';
  }
};



const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nepaliDate, setNepaliDate] = useState('');
  const [mounted, setMounted] = useState(false);

  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    setNepaliDate(getNepaliDate());
    // slight delay to trigger the mount animation
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_TIME = 15 * 60 * 1000;

  const checkRateLimit = () => {
    const stored = localStorage.getItem('rsa_login_attempts');
    if (!stored) return true;
    const { count, firstAttempt } = JSON.parse(stored);
    const now = Date.now();
    if (now - firstAttempt > LOCKOUT_TIME) { localStorage.removeItem('rsa_login_attempts'); return true; }
    if (count >= MAX_ATTEMPTS) {
      const remaining = Math.ceil((LOCKOUT_TIME - (now - firstAttempt)) / 60000);
      setRateLimitError(`Too many failed attempts. Try again in ${remaining} minutes.`);
      return false;
    }
    return true;
  };

  const recordAttempt = () => {
    const stored = localStorage.getItem('rsa_login_attempts');
    const now = Date.now();
    if (stored) { const { count, firstAttempt } = JSON.parse(stored); localStorage.setItem('rsa_login_attempts', JSON.stringify({ count: count + 1, firstAttempt })); }
    else { localStorage.setItem('rsa_login_attempts', JSON.stringify({ count: 1, firstAttempt: now })); }
  };

  const clearAttempts = () => { localStorage.removeItem('rsa_login_attempts'); setRateLimitError(null); };

  const onSubmit = async (data: LoginFormValues) => {
    if (!checkRateLimit()) return;
    setLoading(true);
    try {
      await login(data.email, data.password);
      clearAttempts();
      navigate('/dashboard');
      toast.success('Welcome back!');
    } catch (error: any) {
      recordAttempt();
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

  const inputClass = (hasError?: boolean) =>
    `w-full bg-white/5 border ${hasError
      ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/30'
      : 'border-white/10 focus:border-brand-500/60 focus:ring-brand-500/20'
    } rounded-xl py-3.5 pl-12 pr-12 text-white placeholder-gray-600 focus:outline-none focus:ring-2 transition-all duration-200 text-sm`;

  return (
    <div className="min-h-screen flex bg-[#09090b] overflow-hidden">

      {/* ── NEPALI DATE TOP-RIGHT ── */}
      {nepaliDate && (
        <div className="fixed top-4 right-5 z-50 text-[11px] font-semibold text-brand-400/80 tracking-wide pointer-events-none select-none">
          {nepaliDate}
        </div>
      )}


      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">

        {/* Subtle glow behind form */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />

        {/* Form card — fade-up on mount */}
        <div
          className="relative z-10 w-full max-w-[420px] transition-all duration-700"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          }}
        >
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h2 className="text-2xl font-black text-white">RSA Portal</h2>
            <p className="text-sm text-gray-500 mt-1">Secure staff access</p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1">Sign in to your RSA workspace</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-8"
            style={{ background: 'rgba(28, 28, 31, 0.7)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

            {/* Rate limit error */}
            {rateLimitError && (
              <div className="mb-6 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3">
                <Lock size={16} className="text-rose-400 shrink-0" />
                <p className="text-xs text-rose-300 font-medium">{rateLimitError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors" size={16} />
                  <input
                    type="email"
                    autoComplete="email"
                    className={inputClass(!!errors.email)}
                    placeholder="you@company.com"
                    {...register('email')}
                  />
                </div>
                {errors.email && <p className="text-rose-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Password</label>
                  <Link to="/forgot-password" className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors font-medium">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={inputClass(!!errors.password)}
                    placeholder="••••••••"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-rose-400 text-xs mt-1">{errors.password.message}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !!rateLimitError}
                className="w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl text-sm text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group mt-2"
                style={{ background: loading || rateLimitError ? '#3730a3' : 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}
              >
                {loading
                  ? <Loader2 size={18} className="animate-spin" />
                  : <>
                    Sign In
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                }
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 border-t border-white/6" />
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">or</span>
              <div className="flex-1 border-t border-white/6" />
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-3 text-sm shadow-md"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
              Continue with Google
            </button>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-gray-600">
            New to RSA?{' '}
            <Link to="/signup" className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">
              Request access
            </Link>
          </p>
          <p className="mt-6 text-center text-[10px] text-gray-600 uppercase tracking-widest">
            R. Sapkota & Associates
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;