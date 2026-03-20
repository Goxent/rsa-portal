import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await sendPasswordResetEmail(auth, email);
            setSent(true);
        } catch (err: any) {
            // Don't reveal whether an email exists — generic message
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
                // Still show "sent" to prevent email enumeration
                setSent(true);
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#09090b]">
            {/* Animated Background — matches LoginPage */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/15 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yellow-600/15 rounded-full blur-[120px] animate-pulse delay-1000" />
                <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] bg-orange-500/10 rounded-full blur-[80px]" />
            </div>

            <div className="relative z-10 w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-500">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-2xl shadow-amber-500/30 mb-6 rotate-3 hover:rotate-6 transition-transform duration-500 group">
                        <ShieldCheck size={40} className="text-white group-hover:scale-110 transition-transform" />
                    </div>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-amber-200 tracking-tight mb-2">
                        RSA Portal
                    </h1>
                    <p className="text-gray-400 font-medium">Reset your password</p>
                </div>

                {/* Card */}
                <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl relative overflow-hidden">

                    {sent ? (
                        /* ── Success state ── */
                        <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in duration-300">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                                <CheckCircle2 size={32} className="text-emerald-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white text-center">Check your inbox</h2>
                            <p className="text-sm text-gray-400 text-center leading-relaxed">
                                If <span className="text-amber-300 font-medium">{email}</span> is registered, you'll receive a password reset link shortly.
                            </p>
                            <p className="text-xs text-gray-500 text-center">
                                Check your spam folder if you don't see it within a few minutes.
                            </p>
                            <Link
                                to="/login"
                                className="mt-2 flex items-center gap-2 text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors"
                            >
                                <ArrowLeft size={15} /> Back to Sign In
                            </Link>
                        </div>
                    ) : (
                        /* ── Form state ── */
                        <>
                            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                                Enter your work email address and we'll send you a link to reset your password.
                            </p>

                            {error && (
                                <div className="mb-5 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3">
                                    <AlertCircle size={18} className="text-red-400 shrink-0" />
                                    <p className="text-sm text-red-300">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                                        Email Address
                                    </label>
                                    <div className="relative group">
                                        <Mail
                                            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-amber-400 transition-colors"
                                            size={18}
                                        />
                                        <input
                                            type="email"
                                            required
                                            autoFocus
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                                            placeholder="your@email.com"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-amber-500/20 transform transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : (
                                        'Send Reset Link'
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors font-medium"
                                >
                                    <ArrowLeft size={14} /> Back to Sign In
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
