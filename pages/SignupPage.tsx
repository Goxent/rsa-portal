import RSALogo from '../components/common/RSALogo';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck, Eye, EyeOff, CheckCircle2, Check, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, SignupFormValues } from '../utils/validationSchemas';

const SignupPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const invitedEmail = searchParams.get('email');

  const { signup } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    document.title = 'Sign Up — RSA';
    return () => { document.title = 'RSA'; };
  }, []);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: invitedEmail || ''
    }
  });

  const password = watch('password', '');

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
  const strengthColor = ['', 'text-[var(--color-danger)]', 'text-[var(--color-warning)]', 'text-[var(--accent)]', 'text-[var(--color-success)]'][strengthScore];
  const strengthBg = ['', 'bg-[var(--color-danger)]', 'bg-[var(--color-warning)]', 'bg-[var(--accent)]', 'bg-[var(--color-success)]'][strengthScore];

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
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6 bg-[var(--bg-main)]">
      {/* Signup Card */}
      <div className="w-full max-w-[440px] bg-[var(--bg-surface)] p-8 md:p-10 rounded-2xl border border-[var(--border)] shadow-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6 text-center">
            <RSALogo size="lg" className="mb-3" />
            <h1 className="text-xl font-bold text-[var(--text-heading)] mb-1">
                {invitedEmail ? 'Accept invitation' : 'Create account'}
            </h1>
            <p className="text-[var(--text-muted)] text-xs font-medium">
                {invitedEmail ? 'Join the firm workspace.' : 'Initialize your staff portal account.'}
            </p>
        </div>

        {/* Invitation Status Alert */}
        {invitedEmail ? (
          <div className="mb-6 p-3.5 bg-[rgba(79,178,134,0.1)] border border-[rgba(79,178,134,0.25)] rounded-lg flex items-start gap-3">
            <div className="p-1 rounded-md bg-[rgba(79,178,134,0.15)] flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 size={15} className="text-[var(--color-success)]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-success)]">Invitation verified</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                You have been authorized by RSA Administration to join the workspace.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-3.5 bg-[var(--accent-dim)] border border-[var(--border-accent)] rounded-lg flex items-start gap-3">
            <div className="p-1 rounded-md bg-[var(--accent-dim)] flex items-center justify-center shrink-0 mt-0.5">
              <Info size={15} className="text-[var(--accent)]" />
            </div>
            <p className="text-xs text-[var(--text-body)] leading-relaxed">
              Access is restricted to authorized email addresses in the RSA Staff Directory.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email Field - Locked if invited */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-body)]">Email address</label>
            <div className={`relative ${invitedEmail ? 'opacity-70' : ''}`}>
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={15} />
              <input
                type="email"
                readOnly={!!invitedEmail}
                className={`w-full pl-9 pr-9 py-2.5 rounded-lg bg-[var(--bg-main)] border text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors ${
                  invitedEmail ? 'cursor-not-allowed border-[var(--border)]' : errors.email ? 'border-[var(--color-danger)]' : 'border-[var(--border)]'
                }`}
                placeholder="name@rsapkota.com"
                {...register('email')}
              />
              {invitedEmail && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-success)]">
                  <ShieldCheck size={15} />
                </div>
              )}
            </div>
            {errors.email && <p className="text-[var(--color-danger)] text-[11px] font-medium mt-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-body)]">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={15} />
              <input
                type={showPassword ? 'text' : 'password'}
                className={`w-full pl-9 pr-10 py-2.5 rounded-lg bg-[var(--bg-main)] border text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors ${
                  errors.password ? 'border-[var(--color-danger)]' : 'border-[var(--border)]'
                }`}
                placeholder="Choose a strong password"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className="text-[var(--color-danger)] text-[11px] font-medium mt-1">{errors.password.message}</p>}
            
            {/* Strength Indicators */}
            {password.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strengthScore ? strengthBg : 'bg-[var(--border)]'}`} />
                  ))}
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[var(--text-muted)]">
                    {[{ ok: strength.length, lab: '8+ chars' }, { ok: strength.upper, lab: 'Uppercase' }, { ok: strength.number, lab: 'Number' }, { ok: strength.special, lab: 'Symbol' }].map(r => (
                      <span key={r.lab} className={`flex items-center gap-1 ${r.ok ? 'text-[var(--color-success)] font-medium' : 'text-[var(--text-muted)]'}`}>
                        {r.ok ? <Check size={10} /> : <span className="w-2.5 h-2.5 inline-block text-center">•</span>} {r.lab}
                      </span>
                    ))}
                  </div>
                  <span className={`font-semibold ${strengthColor}`}>{strengthLabel}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-body)]">Confirm password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={15} />
              <input
                type={showConfirm ? 'text' : 'password'}
                className={`w-full pl-9 pr-10 py-2.5 rounded-lg bg-[var(--bg-main)] border text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors ${
                  errors.confirmPassword ? 'border-[var(--color-danger)]' : 'border-[var(--border)]'
                }`}
                placeholder="Repeat your password"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors p-1"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-[var(--color-danger)] text-[11px] font-medium mt-1">{errors.confirmPassword.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-3"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <span>{invitedEmail ? 'Verify & join' : 'Complete setup'}</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
          <p className="text-[var(--text-muted)] text-xs">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--accent)] font-semibold hover:underline ml-1">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
