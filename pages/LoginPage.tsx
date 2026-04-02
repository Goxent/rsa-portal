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
    <div className="min-h-screen flex items-center justify-center bg-navy-950 p-6 relative font-inter overflow-hidden">
      {/* ── NEPALI DATE ── */}
      {nepaliDate && (
        <div className="fixed top-4 right-5 z-50 text-[10px] font-black text-brand-400/60 uppercase tracking-[0.2em] pointer-events-none select-none">
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
        className="w-full max-w-md glass-card p-10 border border-white/10 shadow-2xl relative z-10"
      >
        {/* Brand Header Inside the Card */}
        <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20 mb-4">
                <ShieldCheck size={36} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase mb-1">
                R. Sapkota & Associates
            </h1>
            <div className="h-px w-12 bg-brand-500/30 mb-8" />
            
            <h2 className="text-2xl font-black text-white tracking-tighter">Sign In</h2>
            <p className="text-gray-500 text-sm mt-1">Access your secure RSA workspace dashboard.</p>
        </div>

        {rateLimitError && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 animate-shake">
            <AlertCircle size={18} className="text-rose-400 shrink-0" />
            <p className="text-xs text-rose-300 font-bold">{rateLimitError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors" size={18} />
              <input
                type="email"
                className={`glass-input w-full pl-12 pr-4 py-4 rounded-2xl text-sm transition-all ${errors.email ? 'border-rose-500/50' : ''}`}
                placeholder="your email address"
                {...register('email')}
              />
            </div>
            {errors.email && <p className="text-rose-400 text-[10px] font-bold mt-1 px-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">password</label>
              <Link to="/forgot-password" className="text-[10px] font-black text-brand-400 hover:text-brand-300 uppercase tracking-widest transition-colors">Recover</Link>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                className={`glass-input w-full pl-12 pr-12 py-4 rounded-2xl text-sm transition-all ${errors.password ? 'border-rose-500/50' : ''}`}
                placeholder="password"
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
            className="w-full bg-brand-500 hover:bg-brand-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-brand-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group overflow-hidden relative"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <span className="relative z-10">Access Dashboard</span>
                <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white text-navy-950 hover:bg-gray-100 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 text-sm group shadow-xl hover:shadow-white/5 active:scale-[0.98] border border-white"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Sign in with Google
          </button>
        </div>

        <div className="mt-10 text-center space-y-4">
          <p className="text-gray-500 text-xs">
            System access restricted to authorized personnel.{' '}
            <Link to="/signup" className="text-brand-400 hover:text-brand-300 font-bold transition-colors">Request Account</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;