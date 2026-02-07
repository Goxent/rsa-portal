
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { Navigate, useNavigate } from 'react-router-dom';
import { Mail, RefreshCw, LogOut, CheckCircle } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';

const VerifyEmailPage: React.FC = () => {
    const { user, emailVerified, reloadUser, logout } = useAuth();
    const [sending, setSending] = useState(false);
    const [checking, setChecking] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const navigate = useNavigate();

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
            // AuthContext will update and trigger redirect if verified
        } catch (error: any) {
            setMessage({ type: 'error', text: 'Failed to refresh status.' });
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
            <GlassCard className="max-w-md w-full p-8 text-center space-y-6">
                <div className="flex justify-center">
                    <div className="p-4 bg-blue-500/10 rounded-full">
                        <Mail className="w-12 h-12 text-blue-400" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-white">Verify your email</h1>

                <p className="text-slate-400">
                    We've sent a verification email to <span className="text-blue-400 font-medium">{user.email}</span>.
                    Please click the link in the email to continue.
                </p>

                {message && (
                    <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-3">
                    <button
                        onClick={handleCheckStatus}
                        disabled={checking}
                        className="w-full btn-primary justify-center gap-2 h-11"
                    >
                        {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        I've verified my email
                    </button>

                    <button
                        onClick={handleResend}
                        disabled={sending}
                        className="w-full btn-secondary justify-center gap-2 h-11"
                    >
                        {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        Resend verification email
                    </button>
                </div>

                <button
                    onClick={() => logout()}
                    className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-2 mx-auto transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Sign out
                </button>
            </GlassCard>
        </div>
    );
};

export default VerifyEmailPage;
