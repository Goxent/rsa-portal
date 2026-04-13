import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    User, Phone, ShieldCheck, Briefcase, 
    CheckCircle2, ArrowRight, Loader2, Sparkles,
    UserCircle2, Building2, Smartphone
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const OnboardingPage: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    
    const [formData, setFormData] = useState({
        displayName: user?.displayName || '',
        phoneNumber: user?.phoneNumber || '',
        department: user?.department || 'Audit',
        theme: user?.theme || 'dark'
    });

    useEffect(() => {
        if (user?.isOnboardingComplete) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleComplete = async () => {
        if (!formData.displayName.trim()) {
            toast.error("Please provide your full identity name.");
            return;
        }

        setLoading(true);
        try {
            await AuthService.updateUserProfile(user!.uid, {
                ...formData,
                isOnboardingComplete: true,
                isSetupComplete: true,
                status: 'Active'
            });
            await refreshUser();
            toast.success("Welcome aboard! Workspace initialized.");
            navigate('/dashboard');
        } catch (error: any) {
            toast.error(error.message || "Failed to initialize workspace.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#080a0c] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Aesthetics */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl z-10"
            >
                {/* Header Container */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-brand-500/10 border border-brand-500/20 mb-6 shadow-2xl">
                        <ShieldCheck size={40} className="text-brand-400" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter uppercase mb-3">Initialize Workspace</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-[11px]">Welcome to the RSA Professional Network</p>
                </div>

                {/* Progress Stepper */}
                <div className="flex items-center justify-center gap-4 mb-12">
                    {[1, 2].map(s => (
                        <div 
                            key={s} 
                            className={`h-1.5 w-16 rounded-full transition-all duration-500 ${step >= s ? 'bg-brand-500' : 'bg-white/5'}`} 
                        />
                    ))}
                </div>

                {/* Main Card */}
                <div className="glass-card rounded-[40px] p-10 border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="space-y-8">
                        <div className="space-y-2">
                            <h2 className="text-[14px] font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <UserCircle2 size={18} className="text-brand-400" />
                                Identity & Profile
                            </h2>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Verify how you appear to clients and colleagues</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest ml-1">Full Legal Name</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-brand-400 transition-colors" size={16} />
                                    <input 
                                        className="glass-input w-full !pl-12 !py-4 rounded-xl text-[13px] font-bold"
                                        placeholder="John Doe"
                                        value={formData.displayName}
                                        onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest ml-1">Contact Number</label>
                                <div className="relative group">
                                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-emerald-400 transition-colors" size={16} />
                                    <input 
                                        className="glass-input w-full !pl-12 !py-4 rounded-xl text-[13px] font-bold"
                                        placeholder="Your Contact Number"
                                        value={formData.phoneNumber}
                                        onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest ml-1">Email</label>
                                <input 
                                    className="glass-input w-full !py-4 rounded-xl text-[13px] font-bold opacity-50 cursor-not-allowed border-dashed"
                                    value={user?.email || ''}
                                    disabled
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleComplete}
                            disabled={loading}
                            className="w-full h-[60px] bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[12px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-brand-500/20 disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Finalize Account</>}
                        </button>
                    </div>
                </div>

                <div className="h-8" />
            </motion.div>
        </div>
    );
};

export default OnboardingPage;
