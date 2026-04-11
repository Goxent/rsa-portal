import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, ShieldCheck, CheckCircle2, AlertCircle, ArrowLeft, Zap } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, ResetPasswordFormValues } from '../utils/validationSchemas';
import { AuthService } from '../services/firebase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
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

const ResetPasswordPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const oobCode = searchParams.get('oobCode');
    const navigate = useNavigate();
    
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const [isCodeValid, setIsCodeValid] = useState(false);
    const [success, setSuccess] = useState(false);
    const [nepaliDate, setNepaliDate] = useState('');

    const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormValues>({
        resolver: zodResolver(resetPasswordSchema),
    });

    useEffect(() => {
        setNepaliDate(getNepaliDate());
        
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
            <div className="min-h-screen bg-navy-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Authenticating Payload...</p>
                </div>
            </div>
        );
    }

    if (!isCodeValid && !success) {
        return (
            <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full glass-card p-10 text-center space-y-6"
                >
                    <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
                        <AlertCircle size={40} className="text-rose-400" />
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tighter">Invalid or Expired Link</h2>
                    <p className="text-gray-500 text-sm">This password reset link is no longer valid. For security reasons, reset links expire after one use or after a short period of time.</p>
                    <Link to="/forgot-password" className="w-full bg-brand-500 hover:bg-brand-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2">
                        Request New Link
                    </Link>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-navy-950 overflow-hidden font-inter">
            {/* ── NEPALI DATE ── */}
            {nepaliDate && (
                <div className="fixed top-4 right-5 z-50 text-[10px] font-black text-brand-400/60 uppercase tracking-[0.2em] pointer-events-none select-none">
                    {nepaliDate}
                </div>
            )}

            {/* LEFT PANEL: Brand (Consistent with Login) */}
            <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 bg-[#050507] border-r border-white/5">
                <div className="absolute inset-0 opacity-20 pointer-events-none" 
                    style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(99,102,241,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
                
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 flex flex-col items-center text-center space-y-4"
                >
                    <div className="w-20 h-20 bg-brand-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-brand-500/40 mb-6">
                        <ShieldCheck size={44} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase font-heading">
                        R. SAPKOTA & ASSOCIATES
                    </h1>
                    <p className="text-brand-400/80 font-bold uppercase tracking-[0.3em] text-xs">
                        Security Clearance: Password Override
                    </p>
                </motion.div>
            </div>

            {/* RIGHT PANEL: Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-navy-950 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/5 rounded-full blur-[120px] pointer-events-none" />

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md glass-card p-10 border border-white/10 shadow-2xl relative z-10"
                >
                    {success ? (
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto border border-brand-500/20">
                                <CheckCircle2 size={40} className="text-brand-400" />
                            </div>
                            <h2 className="text-2xl font-black text-white tracking-tighter">System Re-Secured</h2>
                            <p className="text-gray-500 text-sm">Your credentials have been successfully updated. Redirecting to access terminal...</p>
                            <Link to="/login" className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest py-4 rounded-2xl text-xs transition-all flex items-center justify-center gap-2">
                                Access Login Now
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="mb-10 text-inter">
                                <h2 className="text-3xl font-black text-white tracking-tighter">Reset Credentials</h2>
                                <p className="text-gray-500 text-sm mt-2">Establish your new secure access credentials.</p>
                            </div>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">New Password</label>
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
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Confirm New Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand-400 transition-colors z-10" size={18} />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            className={`glass-input w-full !pl-12 pr-12 py-4 rounded-2xl text-sm transition-all ${errors.confirmPassword ? 'border-rose-500/50' : ''}`}
                                            placeholder="••••••••"
                                            {...register('confirmPassword')}
                                        />
                                    </div>
                                    {errors.confirmPassword && <p className="text-rose-400 text-[10px] font-bold mt-1 px-1">{errors.confirmPassword.message}</p>}
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-brand-500 hover:bg-brand-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-brand-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group overflow-hidden relative"
                                >
                                    {loading ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : (
                                        <>
                                            <span className="relative z-10">Override Credentials</span>
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-10 text-center">
                                <Link to="/login" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
                                    <ArrowLeft size={14} /> Abandon Reset
                                </Link>
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
