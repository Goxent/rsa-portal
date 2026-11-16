import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { Navigate } from 'react-router-dom';
import { Mail, RefreshCw, LogOut, CheckCircle } from 'lucide-react';

const VerifyEmailPage: React.FC = () => {
    const { user, emailVerified, reloadUser, logout } = useAuth();
    const [sending, setSending] = useState(false);
    const [checking, setChecking] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    React.useEffect(() => {
        document.title = 'Verify Email — RSA';
        return () => { document.title = 'RSA'; };
    }, []);

    // Redirect if already verified or not logged in
    if (!user) return <Navigate to="/login" replace />;
    if (emailVerified) return <Navigate to="/dashboard" replace />;

    const handleResend = async () => {
        setSending(true);
        setMessage(null);
        try {
            await AuthService.sendVerification();
            setMessage({ type: 'success', text: 'Verification email sent! Please check your inbox.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to send verification email.' });
        } finally {
            setSending(false);
        }
    };

    const handleCheckStatus = async () => {
        setChecking(true);
        try {
            await reloadUser();
        } catch (error: any) {
            setMessage({ type: 'error', text: 'Failed to refresh status.' });
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-6 bg-[var(--bg-main)]">
            <div className="max-w-[420px] w-full bg-[var(--bg-surface)] p-8 md:p-10 rounded-2xl border border-[var(--border)] shadow-sm text-center space-y-5">
                <div className="flex justify-center">
                    <div className="p-3.5 bg-[var(--accent-dim)] border border-[var(--border-accent)] rounded-full text-[var(--accent)]">
                        <Mail className="w-10 h-10" />
                    </div>
                </div>

                <div className="space-y-1">
                    <h1 className="text-xl font-bold text-[var(--text-heading)]">Verify your email</h1>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        We've sent a verification email to <span className="text-[var(--text-heading)] font-semibold">{user.email}</span>.
                        Please click the link in the email to activate your account.
                    </p>
                </div>

                {message && (
                    <div className={`p-3 rounded-lg text-xs font-medium ${
                        message.type === 'success'
                            ? 'bg-[rgba(79,178,134,0.1)] text-[var(--color-success)] border border-[rgba(79,178,134,0.25)]'
                            : 'bg-[rgba(224,112,122,0.1)] text-[var(--color-danger)] border border-[rgba(224,112,122,0.25)]'
                    }`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-2.5 pt-2">
                    <button
                        onClick={handleCheckStatus}
                        disabled={checking}
                        className="w-full h-10 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                    >
                        {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        I've verified my email
                    </button>

                    <button
                        onClick={handleResend}
                        disabled={sending}
                        className="w-full h-10 rounded-lg text-xs font-semibold transition-colors border border-[var(--border)] bg-[var(--bg-main)] hover:bg-[var(--bg-elevated)] text-[var(--text-heading)] flex items-center justify-center gap-2"
                    >
                        {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        Resend verification email
                    </button>
                </div>

                <div className="pt-4 border-t border-[var(--border)]">
                    <button
                        onClick={() => logout()}
                        className="text-[var(--text-muted)] hover:text-[var(--text-heading)] text-xs font-medium flex items-center gap-1.5 mx-auto transition-colors"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmailPage;
