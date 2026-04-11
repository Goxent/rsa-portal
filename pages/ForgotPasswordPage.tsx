import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, ShieldCheck, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
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

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nepaliDate, setNepaliDate] = useState('');

    useEffect(() => {
        setNepaliDate(getNepaliDate());
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
                setError('Service temporary unavailable. Please try again later.');
            }
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

            {/* LEFT PANEL: Brand (Shared) */}
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
                    <div className="w-20 h-20 bg-brand-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-brand-500/40 mb-6 font-heading">
                        <ShieldCheck size={44} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter font-heading uppercase">
                        R. SAPKOTA & ASSOCIATES
                    </h1>
                    <p className="text-brand-400/80 font-bold uppercase tracking-[0.3em] text-xs">
                        Secure Identity Recovery
                    </p>
                </motion.div>

                <div className="relative z-10 w-full max-w-sm space-y-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        className="glass-card p-6 border border-white/5 bg-brand-500/5"
                    >
                        <Zap className="text-brand-400 mb-3" size={20} />
                        <h4 className="text-sm font-bold text-white mb-1">Encrypted recovery paths</h4>
                        <p className="text-xs text-gray-500 leading-relaxed font-medium">We process reset requests via institutional secure channels. Multi-factor authentication may be required.</p>
                    </motion.div>
                </div>
            </div>

            {/* RIGHT PANEL: Recovery Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/5 rounded-full blur-[100px] pointer-events-none" />

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md glass-card p-10 border border-white/10 shadow-2xl relative z-10"
                >
                    {sent ? (
                        <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in duration-300">
                            <div className="w-20 h-20 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                                <CheckCircle2 size={40} className="text-brand-400" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-white tracking-tighter">Transmission Complete</h2>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    If <span className="text-white font-bold">{email}</span> exists in our directory, a reset payload has been dispatched.
                                </p>
                            </div>
                            <Link to="/login" className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest py-4 rounded-2xl text-xs transition-all flex items-center justify-center gap-2">
                                <ArrowLeft size={16} /> Return to Access
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="mb-10">
                                <h2 className="text-3xl font-black text-white tracking-tighter">Identity Recovery</h2>
                                <p className="text-gray-500 text-sm mt-2">Request an institutional password reset payload.</p>
                            </div>

                            {error && (
                                <div className="mb-6 bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3">
                                    <AlertCircle size={18} className="text-rose-400 shrink-0" />
                                    <p className="text-[11px] text-rose-300 font-bold">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-inter">Registered Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors z-10" size={18} />
                                        <input
                                            type="email"
                                            required
                                            className="glass-input w-full !pl-12 pr-4 py-4 rounded-2xl text-sm transition-all"
                                            placeholder="Name@firm.com"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                        />
                                    </div>
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
                                            <span className="relative z-10">Dispatch Reset Payload</span>
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-10 text-center">
                                <Link to="/login" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
                                    <ArrowLeft size={14} /> Back to Sign In
                                </Link>
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
