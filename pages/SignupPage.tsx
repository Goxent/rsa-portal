import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2, Zap, Check, UserPlus, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, SignupFormValues } from '../utils/validationSchemas';
import { motion, AnimatePresence } from 'framer-motion';

const SignupPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const invitedEmail = searchParams.get('email');

  const { signup } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: invitedEmail || ''
    }
  });

  const password = watch('password', '');
  const emailValue = watch('email');

  useEffect(() => {
    if (invitedEmail) {
      setValue('email', invitedEmail);
    }
  }, [invitedEmail, setValue]);

  // Password strength indicators
  const strength = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const strengthScore = Object.values(strength).filter(Boolean).length;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strengthScore];
  const strengthColor = ['', 'text-rose-500', 'text-amber-500', 'text-brand-500', 'text-brand-400'][strengthScore];
  const strengthBg = ['', 'bg-rose-500', 'bg-amber-500', 'bg-brand-500', 'bg-brand-500'][strengthScore];

  const onSubmit = async (data: SignupFormValues) => {
    setLoading(true);
    try {
      await signup(data.email, data.password);
      navigate('/dashboard');
      toast.success('Account verified! Welcome to RSA.');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative font-inter overflow-hidden bg-navy-950">
      
      {/* Decorative Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(99,102,241,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* SIGNUP CARD: High Density Redesign */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[440px] relative z-10 glass-card p-10 border border-white/10 shadow-[0_32px_128px_rgba(0,0,0,1)]"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-10 text-center">
            <div className="h-10 px-4 flex items-center justify-center mb-4 bg-brand-500 rounded-xl shadow-lg shadow-brand-500/20">
                <span className="text-white font-[900] text-[1.1rem] tracking-tight">RSA</span>
            </div>
            <h1 className="text-[13px] font-black uppercase tracking-[0.3em] text-gray-500 mb-10">
                Institutional Portal
            </h1>
            
            <h2 className="text-3xl font-black text-white tracking-tighter">
                {invitedEmail ? 'Accept Invitation' : 'Request Access'}
            </h2>
            <p className="text-gray-500 text-[13px] mt-2 font-medium">
                {invitedEmail ? 'Join the secure professional network.' : 'Initialize your staff account.'}
            </p>
        </div>

        {/* Invitation Status Alert */}
        <AnimatePresence mode="wait">
          {invitedEmail ? (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-start gap-4"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none mt-1">Invitation Verified</p>
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                  You have been authorized by <span className="text-white font-bold">RSA Administration</span> to join the firm workspace.
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="mb-8 p-4 bg-brand-500/5 border border-brand-500/20 rounded-2xl flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                <Info size={16} className="text-brand-400" />
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed py-1">
                Access is restricted to verified email addresses in the <span className="text-white font-bold">RSA Staff Directory</span>.
              </p>
            </div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email Field - Locked if invited */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Email</label>
            <div className={`relative group transition-all ${invitedEmail ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-brand-400 transition-colors z-10" size={16} />
              <input
                type="email"
                readOnly={!!invitedEmail}
                className={`glass-input w-full !pl-11 pr-4 py-3.5 rounded-xl text-[13px] font-bold transition-all ${invitedEmail ? 'bg-black/20 pointer-events-none border-white/5' : ''} ${errors.email ? 'border-rose-500/50' : ''}`}
                placeholder="Email"
                {...register('email')}
              />
              {invitedEmail && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500/40">
                  <ShieldCheck size={16} />
                </div>
              )}
            </div>
            {errors.email && <p className="text-rose-400 text-[9px] font-bold mt-1 px-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-brand-400 transition-colors z-10" size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                className={`glass-input w-full !pl-11 pr-11 py-3.5 rounded-xl text-[13px] transition-all ${errors.password ? 'border-rose-500/50' : ''}`}
                placeholder="Password"
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
            
            {/* Strength Indicators */}
            {password.length > 0 && (
              <div className="mt-3 space-y-2 px-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= strengthScore ? strengthBg : 'bg-white/5'}`} />
                  ))}
                </div>
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tight">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {[{ ok: strength.length, lab: '8+ chars' }, { ok: strength.upper, lab: 'Caps' }, { ok: strength.number, lab: 'Numeric' }, { ok: strength.special, lab: 'Symbol' }].map(r => (
                      <span key={r.lab} className={`flex items-center gap-1 ${r.ok ? 'text-brand-400' : 'text-gray-700'}`}>
                        {r.ok ? <CheckCircle2 size={10} /> : <Check size={10} />} {r.lab}
                      </span>
                    ))}
                  </div>
                  <span className={strengthColor}>{strengthLabel}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Confirm Identity</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-brand-400 transition-colors z-10" size={16} />
              <input
                type={showConfirm ? 'text' : 'password'}
                className={`glass-input w-full !pl-11 pr-11 py-3.5 rounded-xl text-[13px] transition-all ${errors.confirmPassword ? 'border-rose-500/50' : ''}`}
                placeholder="Repeat your secret..."
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-700 hover:text-white transition-colors"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-rose-400 text-[9px] font-bold mt-1 px-1">{errors.confirmPassword.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white h-[52px] rounded-xl font-black uppercase tracking-[0.2em] text-[11px] transition-all shadow-xl shadow-brand-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group relative overflow-hidden mt-6"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span className="relative z-10">{invitedEmail ? 'Verify & Join' : 'Complete Setup'}</span>
                <ArrowRight size={16} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-x-0 bottom-0 h-[100%] bg-gradient-to-t from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
              </>
            )}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-white/5 text-center">
          <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest">
            Existing Workspace?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-200 transition-colors ml-2">Login Here</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;
