import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck, Eye, EyeOff, User, AlertCircle, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, SignupFormValues } from '../utils/validationSchemas';
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
  const [mounted, setMounted] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const password = watch('password', '');

  useEffect(() => {
    setNepaliDate(getNepaliDate());
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
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
  const strengthColor = ['', '#f43f5e', '#f59e0b', '#10b981', '#6366f1'][strengthScore];

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

  const inputClass = (hasError?: boolean) =>
    `w-full bg-white/5 border ${hasError
      ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/30'
      : 'border-white/10 focus:border-brand-500/60 focus:ring-brand-500/20'
    } rounded-xl py-3.5 pl-12 pr-12 text-white placeholder-gray-600 focus:outline-none focus:ring-2 transition-all duration-200 text-sm`;

  return (
    <div className="min-h-screen flex bg-[#09090b] overflow-hidden">

      {/* Nepali date top-right */}
      {nepaliDate && (
        <div className="fixed top-4 right-5 z-50 text-[11px] font-semibold text-brand-400/80 tracking-wide pointer-events-none select-none">
          {nepaliDate}
        </div>
      )}


      <div className="flex-1 flex items-center justify-center px-6 py-12 relative overflow-y-auto">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />

        <div
          className="relative z-10 w-full max-w-[420px] transition-all duration-700"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(24px)' }}
        >
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h2 className="text-2xl font-black text-white">RSA Portal</h2>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">Create your account</h2>
            <p className="text-sm text-gray-500 mt-1">Admin-invite only — ensure your email is registered.</p>
          </div>

          {/* Notice */}
          <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <AlertCircle size={15} className="text-brand-400 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-200/70">
              Only emails added to the Staff Directory by an Administrator can register. Contact your manager or admin if you need access.
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-8"
            style={{ background: 'rgba(28, 28, 31, 0.7)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

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
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={inputClass(!!errors.password)}
                    placeholder="Create a strong password"
                    {...register('password')}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-rose-400 text-xs mt-1">{errors.password.message}</p>}

                {/* Password strength bar */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1.5">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ background: i <= strengthScore ? strengthColor : 'rgba(255,255,255,0.08)' }} />
                      ))}
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex gap-3">
                        {[
                          { ok: strength.length, label: '8+ chars' },
                          { ok: strength.upper, label: 'Uppercase' },
                          { ok: strength.number, label: 'Number' },
                          { ok: strength.special, label: 'Symbol' },
                        ].map(r => (
                          <span key={r.label} className={`text-[10px] font-medium flex items-center gap-0.5 ${r.ok ? 'text-emerald-400' : 'text-gray-600'}`}>
                            <Check size={9} /> {r.label}
                          </span>
                        ))}
                      </div>
                      {strengthLabel && (
                        <span className="text-[10px] font-bold" style={{ color: strengthColor }}>{strengthLabel}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Confirm Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors" size={16} />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={inputClass(!!errors.confirmPassword)}
                    placeholder="Repeat your password"
                    {...register('confirmPassword')}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-rose-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl text-sm text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 group mt-2"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' }}
              >
                {loading
                  ? <Loader2 size={18} className="animate-spin" />
                  : <>
                    Create Account
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                }
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">
              Sign in
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

export default SignupPage;
