import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormValues } from '../utils/validationSchemas';
import { motion } from 'framer-motion';

import RSALogo from '../components/common/RSALogo';

const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });
  const watchEmail = watch('email');

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
      setRateLimitError(`Account locked. Try again in ${remaining} minutes.`);
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
    setRateLimitError(null);
    try {
      await login(data.email, data.password);
      clearAttempts();
      navigate('/dashboard');
      toast.success('Access Granted');
    } catch (error: any) {
      recordAttempt();
      
      // Check for first-time invited users who haven't signed up yet
      if (error.code === 'auth/user-not-found' || error.message.includes('not found')) {
        try {
          // Quick check in firestore to see if they are a "Pending" invited user
          const { AuthService } = await import('../services/firebase');
          const statusResult = await AuthService.checkInvitationStatus(data.email);
          
          if (statusResult.isInvited && !statusResult.isRegistered) {
            setRateLimitError("You have an active invitation but haven't set up your account yet.");
            toast.error("Invitation found. Please complete your signup first.", { duration: 5000 });
            return;
          }
        } catch (e) {
          console.error("Failed to check invitation status:", e);
        }
      }
      
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await googleLogin();
      navigate('/dashboard');
      toast.success('Access Granted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative font-inter overflow-hidden bg-[#05070a]">
      
      {/* Decorative Elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(99,102,241,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* LOGIN CARD */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-[420px] relative z-10 glass-card p-10 border border-white/10 shadow-[0_32px_128px_rgba(0,0,0,1)]"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-10 text-center">
            <RSALogo size="md" className="mb-6 scale-110" />
            
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-500/80 mb-2">
                Unified Portal
            </p>
            <h2 className="text-3xl font-black text-white tracking-tighter mb-2">Login To Identity</h2>
            <p className="text-gray-500 text-[12px] font-medium leading-relaxed">Authorized RSA Personnel Only.</p>
        </div>

        {rateLimitError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex flex-col gap-2">
            <div className="flex items-center gap-3 text-rose-400 text-xs font-bold">
              <AlertCircle size={16} className="shrink-0" />
              {rateLimitError}
            </div>
            {rateLimitError.includes("invitation") && (
              <Link to={`/signup?email=${encodeURIComponent(watchEmail)}`} className="text-[10px] font-black uppercase tracking-widest text-brand-400 hover:text-brand-300 transition-colors ml-7">
                Complete Signup Now →
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Email</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-brand-400 transition-colors z-10" size={16} />
              <input
                type="email"
                className={`glass-input w-full !pl-11 pr-4 py-3.5 rounded-xl text-[13px] font-bold transition-all ${errors.email ? 'border-rose-500/50' : ''}`}
                placeholder="Email"
                {...register('email')}
              />
            </div>
            {errors.email && <p className="text-rose-400 text-[9px] font-bold mt-1 px-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Password</label>
              <Link to="/forgot-password"  className="text-[9px] font-black text-brand-400 hover:text-brand-300 uppercase tracking-widest transition-colors">Recover Access</Link>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-brand-400 transition-colors z-10" size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                className={`glass-input w-full !pl-11 pr-11 py-3.5 rounded-xl text-[13px] transition-all ${errors.password ? 'border-rose-500/50' : ''}`}
                placeholder="••••••••"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-700 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-rose-400 text-[9px] font-bold mt-1 px-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || !!rateLimitError?.includes("locked")}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white h-[52px] rounded-xl font-black uppercase tracking-[0.2em] text-[11px] transition-all shadow-xl shadow-brand-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 group relative overflow-hidden"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span className="relative z-10">Authenticate</span>
                <ArrowRight size={16} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-x-0 bottom-0 h-[100%] bg-gradient-to-t from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-10 text-center flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <span className="relative z-10 px-4 text-[10px] font-black text-gray-700 uppercase tracking-[0.3em] bg-[#0c1015] rounded-full py-0.5 border border-white/5">Integrations</span>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full h-[52px] bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 text-[10px] text-gray-300 shadow-sm active:scale-[0.98]"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
          Single Sign-on
        </button>

        <div className="mt-8 space-y-4">
          <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest text-center">New staff identity?</p>
          <div className="grid grid-cols-1 gap-3">
            <Link 
              to="/signup" 
              className="group flex items-center justify-between px-6 py-4 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-brand-500/10 hover:border-brand-500/30 transition-all shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 group-hover:bg-brand-500 group-hover:text-white transition-all shadow-inner">
                  <UserPlus size={18} />
                </div>
                <div className="text-left">
                  <span className="block text-[11px] font-black text-white uppercase tracking-wider">Accept Invitation</span>
                  <span className="block text-[9px] font-bold text-gray-600 mt-1 uppercase tracking-widest">First-time Workspace Setup</span>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-700 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </div>

        <div className="mt-12 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-[10px] font-black text-gray-800 uppercase tracking-widest pt-4 border-t border-white/5">
            <ShieldCheck size={12} className="text-brand-500/40" />
            Secure End-to-End Encryption
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;