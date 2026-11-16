import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormValues } from '../utils/validationSchemas';
import { SessionLimitError } from '../services/firebase';
import { SessionMetadata } from '../services/sessionService';
import DeviceChooserModal from '../components/DeviceChooserModal';
import RSALogo from '../components/common/RSALogo';

const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deviceModal, setDeviceModal] = useState<{
      sessions: SessionMetadata[];
      uid: string;
      email: string;
      password: string;
  } | null>(null);

  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    document.title = 'Sign In — RSA';
    return () => { document.title = 'RSA'; };
  }, []);

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
      if (error instanceof SessionLimitError || error.name === 'SessionLimitError') {
        setDeviceModal({
            sessions: error.sessions,
            uid: error.uid,
            email: data.email,
            password: data.password,
        });
        setLoading(false);
        return;
      }

      recordAttempt();
      
      if (error.code === 'auth/user-not-found' || error.message.includes('not found')) {
        try {
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

  const handleDeviceChooserSuccess = async () => {
    if (!deviceModal) return;
    setDeviceModal(null);
    setLoading(true);
    try {
        await login(deviceModal.email, deviceModal.password);
        clearAttempts();
        navigate('/dashboard');
        toast.success('Access Granted');
    } catch (err: any) {
        toast.error(err.message || 'Login failed. Please try again.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6 bg-[var(--bg-main)]">
      {/* Login Card */}
      <div className="w-full max-w-[420px] bg-[var(--bg-surface)] p-8 md:p-10 rounded-2xl border border-[var(--border)] shadow-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6 text-center">
            <RSALogo size="xl" className="mb-4" />
            
            <h1 className="text-xl font-bold text-[var(--text-heading)] mb-1">Welcome back</h1>
            <p className="text-[var(--text-muted)] text-xs font-medium">Sign in to your RSA account</p>
        </div>

        {rateLimitError && (
          <div className="mb-5 p-3.5 rounded-lg bg-[rgba(224,112,122,0.1)] border border-[rgba(224,112,122,0.25)] flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[var(--color-danger)] text-xs font-semibold">
              <AlertCircle size={15} className="shrink-0" />
              {rateLimitError}
            </div>
            {rateLimitError.includes("invitation") && (
              <Link to={`/signup?email=${encodeURIComponent(watchEmail)}`} className="text-xs font-semibold text-[var(--accent)] hover:underline ml-6">
                Complete signup now →
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-body)]">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={15} />
              <input
                type="email"
                className={`w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-[var(--bg-main)] border text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors ${
                  errors.email ? 'border-[var(--color-danger)]' : 'border-[var(--border)]'
                }`}
                placeholder="name@rsapkota.com"
                {...register('email')}
              />
            </div>
            {errors.email && <p className="text-[var(--color-danger)] text-[11px] font-medium mt-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-[var(--text-body)]">Password</label>
              <Link to="/forgot-password" className="text-xs font-medium text-[var(--accent)] hover:underline transition-colors">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={15} />
              <input
                type={showPassword ? 'text' : 'password'}
                className={`w-full pl-9 pr-10 py-2.5 rounded-lg bg-[var(--bg-main)] border text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors ${
                  errors.password ? 'border-[var(--color-danger)]' : 'border-[var(--border)]'
                }`}
                placeholder="••••••••"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors p-1"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className="text-[var(--color-danger)] text-[11px] font-medium mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || !!rateLimitError?.includes("locked")}
            className="w-full h-10 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div className="relative my-6 text-center flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--border)]"></div></div>
            <span className="relative z-10 px-3 text-xs text-[var(--text-muted)] bg-[var(--bg-surface)]">or</span>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          aria-label="Sign in with Google"
          className="w-full h-10 bg-[var(--bg-main)] hover:bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg font-medium transition-colors flex items-center justify-center gap-2.5 text-xs text-[var(--text-heading)]"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
          Continue with Google
        </button>

        <div className="mt-6 space-y-3">
          <p className="text-xs text-[var(--text-muted)] text-center font-medium">New to RSA?</p>
          <Link 
            to="/signup" 
            className="flex items-center justify-between p-3.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-accent)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-[var(--accent)]">
                <UserPlus size={16} />
              </div>
              <div className="text-left">
                <span className="block text-xs font-semibold text-[var(--text-heading)]">Create account</span>
                <span className="block text-[11px] text-[var(--text-muted)]">Set up your portal access</span>
              </div>
            </div>
            <ArrowRight size={15} className="text-[var(--text-muted)]" />
          </Link>
        </div>

        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-muted)] pt-4 border-t border-[var(--border)]">
            <ShieldCheck size={14} className="text-[var(--accent)]" />
            Secured with end-to-end encryption
          </div>
        </div>
      </div>

      {/* Device Chooser Modal */}
      {deviceModal && (
          <DeviceChooserModal
              isOpen={!!deviceModal}
              sessions={deviceModal.sessions}
              uid={deviceModal.uid}
              onSuccess={handleDeviceChooserSuccess}
              onCancel={() => setDeviceModal(null)}
          />
      )}
    </div>
  );
};

export default LoginPage;
