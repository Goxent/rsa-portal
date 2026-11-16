import RSALogo from '../components/common/RSALogo';
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, ResetPasswordFormValues } from '../utils/validationSchemas';
import { AuthService } from '../services/firebase';
import toast from 'react-hot-toast';

const ResetPasswordPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const oobCode = searchParams.get('oobCode');
    const navigate = useNavigate();
    
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const [isCodeValid, setIsCodeValid] = useState(false);
    const [success, setSuccess] = useState(false);

    React.useEffect(() => {
        document.title = 'Reset Password — RSA';
        return () => { document.title = 'RSA'; };
    }, []);

    const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormValues>({
        resolver: zodResolver(resetPasswordSchema),
    });

    useEffect(() => {
        const verifyCode = async () => {
            if (!oobCode) {
                toast.error("No reset code found. Please request a new link.");
                setVerifying(false);
                return;
            }
            
            try {
                await AuthService.verifyResetCode(oobCode);
                setIsCodeValid(true);
            } catch (err: any) {
                toast.error(err.message);
                setIsCodeValid(false);
            } finally {
                setVerifying(false);
            }
        };

        verifyCode();
    }, [oobCode]);

    const onSubmit = async (data: ResetPasswordFormValues) => {
        if (!oobCode) return;
        
        setLoading(true);
        try {
            await AuthService.confirmResetPassword(oobCode, data.password);
            setSuccess(true);
            toast.success("Password reset successfully!");
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (verifying) {
        return (
            <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
                    <p className="text-xs text-[var(--text-muted)] font-medium">Verifying reset link...</p>
                </div>
            </div>
        );
    }

    if (!isCodeValid && !success) {
        return (
            <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4 md:p-6">
                <div className="max-w-[420px] w-full bg-[var(--bg-surface)] p-8 md:p-10 rounded-2xl border border-[var(--border)] shadow-sm text-center space-y-5">
                    <div className="w-14 h-14 bg-[rgba(224,112,122,0.1)] rounded-full flex items-center justify-center mx-auto border border-[rgba(224,112,122,0.25)] text-[var(--color-danger)]">
                        <AlertCircle size={28} />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold text-[var(--text-heading)]">Invalid or expired link</h2>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">This password reset link is no longer valid. Reset links expire after one use or after a short period of time.</p>
                    </div>
                    <Link
                        to="/forgot-password"
                        className="w-full h-10 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                    >
                        Request new link
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-6 bg-[var(--bg-main)]">
            <div className="w-full max-w-[420px] bg-[var(--bg-surface)] p-8 md:p-10 rounded-2xl border border-[var(--border)] shadow-sm">
                <div className="flex flex-col items-center mb-6 text-center">
                    <RSALogo size="lg" className="mb-3" />
                    <h1 className="text-xl font-bold text-[var(--text-heading)] mb-1">
                        {success ? 'Password updated' : 'Set new password'}
                    </h1>
                    <p className="text-[var(--text-muted)] text-xs font-medium">
                        {success ? 'Your account has been secured' : 'Enter your new credentials below'}
                    </p>
                </div>

                {success ? (
                    <div className="text-center space-y-5">
                        <div className="w-14 h-14 bg-[rgba(79,178,134,0.1)] rounded-full flex items-center justify-center mx-auto border border-[rgba(79,178,134,0.25)] text-[var(--color-success)]">
                            <CheckCircle2 size={28} />
                        </div>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            Your password has been successfully updated. Redirecting to sign in...
                        </p>
                        <Link
                            to="/login"
                            className="w-full h-10 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                        >
                            Sign in now
                        </Link>
                    </div>
                ) : (
                    <>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-[var(--text-body)]">New password</label>
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
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors p-1"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                                {errors.password && <p className="text-[var(--color-danger)] text-[11px] font-medium mt-1">{errors.password.message}</p>}
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-[var(--text-body)]">Confirm new password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={15} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className={`w-full pl-9 pr-10 py-2.5 rounded-lg bg-[var(--bg-main)] border text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors ${
                                            errors.confirmPassword ? 'border-[var(--color-danger)]' : 'border-[var(--border)]'
                                        }`}
                                        placeholder="••••••••"
                                        {...register('confirmPassword')}
                                    />
                                </div>
                                {errors.confirmPassword && <p className="text-[var(--color-danger)] text-[11px] font-medium mt-1">{errors.confirmPassword.message}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-10 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                            >
                                {loading ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <span>Update password</span>
                                )}
                            </button>
                        </form>

                        <div className="mt-6 pt-5 border-t border-[var(--border)] text-center">
                            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors">
                                <ArrowLeft size={13} /> Back to sign in
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ResetPasswordPage;
