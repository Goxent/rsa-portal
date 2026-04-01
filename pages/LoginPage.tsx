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
    <div className="min-h-screen flex bg-navy-950 overflow-hidden font-inter">
      {/* ── NEPALI DATE ── */}
      {nepaliDate && (
        <div className="fixed top-4 right-5 z-50 text-[10px] font-black text-brand-400/60 uppercase tracking-[0.2em] pointer-events-none select-none">
          {nepaliDate}
        </div>
      )}

      {/* LEFT PANEL: Brand & Workflow Preview */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 bg-[#050507] border-r border-white/5 overflow-hidden">
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(99,102,241,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute -left-20 -top-20 w-96 h-96 bg-brand-600/10 rounded-full blur-[120px]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 flex flex-col items-center text-center space-y-4 mb-16"
        >
          <div className="w-20 h-20 bg-brand-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-brand-500/40 mb-6">
            <ShieldCheck size={44} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter font-heading">
            R. SAPKOTA & ASSOCIATES
          </h1>
          <p className="text-brand-400/80 font-bold uppercase tracking-[0.3em] text-xs">
            Audit & Compliance Redefined
          </p>
        </motion.div>

        {/* Phase Workflow Preview */}
        <div className="relative z-10 w-full max-w-sm space-y-4">
          {[
            { phase: 'Onboarding', icon: <Zap size={16} />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
            { phase: 'Planning & Execution', icon: <CheckCircle2 size={16} />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { phase: 'Final Review', icon: <ShieldCheck size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' }
          ].map((item, i) => (
            <motion.div
              key={item.phase}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + (i * 0.2), duration: 0.6 }}
              className="glass-card p-4 flex items-center gap-4 border border-white/5 hover:border-brand-500/30 transition-all group"
            >
              <div className={`p-2.5 rounded-xl ${item.bg} ${item.color} group-hover:scale-110 transition-transform`}>
                {item.icon}
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{`Step 0${i+1}`}</p>
                <p className="text-sm font-bold text-white">{item.phase}</p>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shadow-lg shadow-brand-500/50 animate-pulse" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/5 rounded-full blur-[100px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md glass-card p-10 border border-white/10 shadow-2xl relative z-10"
        >
          <div className="mb-10">
            <h2 className="text-3xl font-black text-white tracking-tighter">Sign In</h2>
            <p className="text-gray-500 text-sm mt-2">Access your secure RSA workspace dashboard.</p>
          </div>

          {rateLimitError && (
            <div className="mb-6 bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 animate-shake">
              <AlertCircle size={18} className="text-rose-400 shrink-0" />
              <p className="text-xs text-rose-300 font-bold">{rateLimitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Identity</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors" size={18} />
                <input
                  type="email"
                  className={`glass-input w-full pl-12 pr-4 py-4 rounded-2xl text-sm transition-all ${errors.email ? 'border-rose-500/50' : ''}`}
                  placeholder="name@firm.com"
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="text-rose-400 text-[10px] font-bold mt-1 px-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Secret</label>
                <Link to="/forgot-password" className="text-[10px] font-black text-brand-400 hover:text-brand-300 uppercase tracking-widest transition-colors">Recover</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`glass-input w-full pl-12 pr-12 py-4 rounded-2xl text-sm transition-all ${errors.password ? 'border-rose-500/50' : ''}`}
                  placeholder="••••••••"
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

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-[#0c0c0e] px-4 text-gray-600 tracking-[0.3em]">Institutional Single Sign-On</span></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 text-sm group"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Identity Provider Login
          </button>

          <div className="mt-10 text-center space-y-4">
            <p className="text-gray-500 text-xs">
              System access restricted to authorized personnel.{' '}
              <Link to="/signup" className="text-brand-400 hover:text-brand-300 font-bold transition-colors">Request Account</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;