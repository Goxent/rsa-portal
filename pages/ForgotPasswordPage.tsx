import RSALogo from '../components/common/RSALogo';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        document.title = 'Forgot Password — RSA';
        return () => { document.title = 'RSA'; };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await sendPasswordResetEmail(auth, email);
            setSent(true);
        } catch (err: any) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
                setSent(true);
            } else {
                setError('Service temporarily unavailable. Please try again later.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-6 bg-[var(--bg-main)]">
            <div className="w-full max-w-[420px] bg-[var(--bg-surface)] p-8 md:p-10 rounded-2xl border border-[var(--border)] shadow-sm">
                <div className="flex flex-col items-center mb-6 text-center">
                    <RSALogo size="lg" className="mb-3" />
                    <h1 className="text-xl font-bold text-[var(--text-heading)] mb-1">
                        {sent ? 'Check your email' : 'Reset your password'}
                    </h1>
                    <p className="text-[var(--text-muted)] text-xs font-medium">
                        {sent ? 'Instructions have been dispatched' : 'Enter your registered email address to receive a recovery link'}
                    </p>
                </div>

                {sent ? (
                    <div className="space-y-5 text-center">
                        <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(79,178,134,0.1)] border border-[rgba(79,178,134,0.25)] flex items-center justify-center text-[var(--color-success)]">
                            <CheckCircle2 size={28} />
                        </div>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            If an account exists for <span className="font-semibold text-[var(--text-heading)]">{email}</span>, a password reset link has been sent.
                        </p>
                        <div className="pt-2">
                            <Link
                                to="/login"
                                className="w-full h-10 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                            >
                                <ArrowLeft size={15} /> Return to sign in
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="mb-4 bg-[rgba(224,112,122,0.1)] border border-[rgba(224,112,122,0.25)] p-3 rounded-lg flex items-center gap-2">
                                <AlertCircle size={15} className="text-[var(--color-danger)] shrink-0" />
                                <p className="text-xs text-[var(--color-danger)] font-medium">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-[var(--text-body)]">Email address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={15} />
                                    <input
                                        type="email"
                                        required
                                        className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                        placeholder="name@rsapkota.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>
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
                                    <span>Send reset link</span>
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

export default ForgotPasswordPage;
