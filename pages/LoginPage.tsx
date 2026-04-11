import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormValues } from '../utils/validationSchemas';
import { motion, AnimatePresence } from 'framer-motion';
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

  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    setNepaliDate(getNepaliDate());
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
    if (stored) { 
      const { count, firstAttempt } = JSON.parse(stored); 
      localStorage.setItem('rsa_login_attempts', JSON.stringify({ count: count + 1, firstAttempt })); 
    } else { 
      localStorage.setItem('rsa_login_attempts', JSON.stringify({ count: 1, firstAttempt: now })); 
    }
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative font-inter overflow-hidden" 
         style={{ background: 'var(--bg-main)', backgroundImage: 'radial-gradient(circle at 50% 50%, var(--bg-grad-1) 0%, var(--bg-main) 100%)' }}>
      
      {/* ── NEPALI DATE ── */}
      {nepaliDate && (
        <div className="fixed top-4 right-5 z-50 text-[10px] font-black uppercase tracking-[0.2em] pointer-events-none select-none"
             style={{ color: 'var(--accent)', opacity: 0.6 }}>
          {nepaliDate}
        </div>
      )}

      {/* Decorative Elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(99,102,241,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* LOGIN CARD */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[400px] relative z-10"
        style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border)', 
          borderRadius: 'var(--radius-xl)', 
          padding: '2.5rem',
          boxShadow: 'var(--shadow-modal)'
        }}
      >
        {/* Brand Header Inside the Card */}
        <div className="flex flex-col items-center mb-10 text-center">
            {/* Logo/Brand Block */}
            <div className="w-10 h-10 flex items-center justify-center mb-3"
                 style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary))', borderRadius: 'var(--radius-md)' }}>
                <span className="text-white font-[800] text-[1.25rem]">R</span>
            </div>
            <h1 className="text-[1rem] font-[700] uppercase tracking-tighter" style={{ color: 'var(--text-heading)', marginTop: '0.75rem' }}>
                R. Sapkota & Associates
            </h1>

            <div className="h-[1px] w-full my-8" style={{ background: 'var(--border)' }} />
            
            <h2 className="text-2xl font-black tracking-tighter" style={{ color: 'var(--text-heading)' }}>Sign In</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Access your secure RSA workspace.</p>
        </div>

        {rateLimitError && (
          <div className="mb-6 flex items-center gap-3"
               style={{ 
                 color: 'var(--color-danger)', 
                 background: 'rgba(196,68,90,0.1)', 
                 borderRadius: 'var(--radius-sm)', 
                 padding: '0.625rem 0.875rem', 
                 border: '1px solid rgba(196,68,90,0.2)', 
                 fontSize: '0.875rem' 
               }}>
            <AlertCircle size={18} className="shrink-0" />
            <p className="font-bold">{rateLimitError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors z-10" size={18} />
              <input
                type="email"
                className={`glass-input w-full !pl-12 pr-4 py-4 rounded-2xl text-sm transition-all ${errors.email ? 'border-rose-500/50' : ''}`}
                placeholder="Your email address"
                {...register('email')}
              />
            </div>
            {errors.email && <p className="text-rose-400 text-[10px] font-bold mt-1 px-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">password</label>
              <div className="flex items-center gap-3">
                <Link to="/forgot-password" className="text-[10px] font-black text-brand-400 hover:text-brand-300 uppercase tracking-widest transition-colors">Forgot Password?</Link>
                <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                <Link to="/reset-password" className="text-[10px] font-black text-gray-500 hover:text-brand-400 uppercase tracking-widest transition-colors">Reset</Link>
              </div>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors z-10" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                className={`glass-input w-full !pl-12 pr-12 py-4 rounded-2xl text-sm transition-all ${errors.password ? 'border-rose-500/50' : ''}`}
                placeholder="Password"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-rose-400 text-[10px] font-bold mt-1 px-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || !!rateLimitError}
            className="w-full btn-primary py-3 rounded-[var(--radius-md)] font-bold text-sm transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>Log in</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="relative my-8 text-center flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full bg-[var(--border)] h-[1px]"></div></div>
            <span className="relative z-10 px-4 text-[0.8125rem]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>OR</span>
        </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full font-bold py-2.5 rounded-[var(--radius-md)] transition-all flex items-center justify-center gap-3 text-sm border hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-heading)', borderColor: 'var(--border-mid)' }}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
            Sign in with Google
          </button>

        <div className="mt-8 text-center">
          <p className="text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>
            System access restricted to authorized personnel.{' '}
            <Link to="/signup" className="font-bold hover:underline transition-colors" style={{ color: 'var(--accent)' }}>Request Account</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;