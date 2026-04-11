import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck, Eye, EyeOff, AlertCircle, CheckCircle2, Zap, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, SignupFormValues } from '../utils/validationSchemas';
import { motion } from 'framer-motion';
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

const SignupPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nepaliDate, setNepaliDate] = useState('');

  const { signup } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const password = watch('password', '');

  useEffect(() => {
    setNepaliDate(getNepaliDate());
  }, []);

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
      toast.success('Account created! Welcome to RSA.');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
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

      {/* LEFT PANEL: Brand & Workflow Preview (Shared with Login) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 bg-[#050507] border-r border-white/5 overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(99,102,241,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-brand-600/10 rounded-full blur-[120px]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 flex flex-col items-center text-center space-y-4 mb-16"
        >
          <div className="w-20 h-20 bg-brand-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-brand-500/40 mb-6">
            <ShieldCheck size={44} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter font-heading uppercase">
            R. SAPKOTA & ASSOCIATES
          </h1>
          <p className="text-brand-400/80 font-bold uppercase tracking-[0.3em] text-xs">
            Join the Secure Network
          </p>
        </motion.div>

        <div className="relative z-10 w-full max-w-sm space-y-4">
          {[
            { phase: 'Verify Identity', icon: <Mail size={16} />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
            { phase: 'Configure Workspace', icon: <Zap size={16} />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { phase: 'Complete Onboarding', icon: <CheckCircle2 size={16} />, color: 'text-brand-400', bg: 'bg-brand-400/10' }
          ].map((item, i) => (
            <motion.div
              key={item.phase}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + (i * 0.2), duration: 0.6 }}
              className="glass-card p-4 flex items-center gap-4 border border-white/5"
            >
              <div className={`p-2.5 rounded-xl ${item.bg} ${item.color}`}>
                {item.icon}
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Step 0{i+1}</p>
                <p className="text-sm font-bold text-white">{item.phase}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative overflow-y-auto custom-scrollbar">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/5 rounded-full blur-[100px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md glass-card p-10 border border-white/10 shadow-2xl relative z-10 my-8"
        >
          <div className="mb-8">
            <h2 className="text-3xl font-black text-white tracking-tighter">Register</h2>
            <p className="text-gray-500 text-sm mt-2">Initialize your institutional staff account.</p>
          </div>

          <div className="mb-8 bg-brand-500/5 border border-brand-500/20 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle size={18} className="text-brand-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
              Registration is restricted to emails registered in the <span className="text-white font-bold">Staff Directory</span>. Contact System Admin for authorization.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Work Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors z-10" size={18} />
                <input
                  type="email"
                  className={`glass-input w-full !pl-12 pr-4 py-4 rounded-2xl text-sm transition-all ${errors.email ? 'border-rose-500/50' : ''}`}
                  placeholder="Name@firm.com"
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="text-rose-400 text-[10px] font-bold mt-1 px-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Secret Key</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors z-10" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`glass-input w-full !pl-12 pr-12 py-4 rounded-2xl text-sm transition-all ${errors.password ? 'border-rose-500/50' : ''}`}
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
              
              {/* Strength Indicators */}
              {password.length > 0 && (
                <div className="mt-3 space-y-2 px-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= strengthScore ? strengthBg : 'bg-white/5'}`} />
                    ))}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {[{ ok: strength.length, lab: '8+ chars' }, { ok: strength.upper, lab: 'ABC' }, { ok: strength.number, lab: '123' }, { ok: strength.special, lab: '#!$' }].map(r => (
                        <span key={r.lab} className={`text-[9px] font-black uppercase flex items-center gap-1 ${r.ok ? 'text-brand-400' : 'text-gray-600'}`}>
                          <Check size={8} /> {r.lab}
                        </span>
                      ))}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${strengthColor}`}>{strengthLabel}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Validate Secret</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors z-10" size={18} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className={`glass-input w-full !pl-12 pr-12 py-4 rounded-2xl text-sm transition-all ${errors.confirmPassword ? 'border-rose-500/50' : ''}`}
                  placeholder="Repeat your secret"
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-rose-400 text-[10px] font-bold mt-1 px-1">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-brand-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group relative overflow-hidden"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span className="relative z-10">Register Account</span>
                  <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-gray-500 text-xs font-medium">
              Existing credentials?{' '}
              <Link to="/login" className="text-brand-400 hover:text-brand-300 font-bold transition-colors">Sign In Instead</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SignupPage;
