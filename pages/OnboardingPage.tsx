import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { 
    User, ShieldCheck, 
    CheckCircle2, Loader2,
    UserCircle2, Smartphone
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const OnboardingPage: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        displayName: user?.displayName || '',
        phoneNumber: user?.phoneNumber || '',
        department: user?.department || 'Audit',
        theme: user?.theme || 'dark'
    });

    React.useEffect(() => {
        document.title = 'Complete Setup — RSA';
        return () => { document.title = 'RSA'; };
    }, []);

    useEffect(() => {
        if (user?.isOnboardingComplete) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleComplete = async () => {
        if (!formData.displayName.trim()) {
            toast.error("Please provide your full legal name.");
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
        <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4 md:p-6">
            <div className="w-full max-w-lg bg-[var(--bg-surface)] p-8 md:p-10 rounded-2xl border border-[var(--border)] shadow-sm">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent-dim)] border border-[var(--border-accent)] mb-4 text-[var(--accent)]">
                        <ShieldCheck size={28} />
                    </div>
                    <h1 className="text-xl font-bold text-[var(--text-heading)] mb-1">Initialize workspace</h1>
                    <p className="text-xs text-[var(--text-muted)] font-medium">Welcome to the R. Sapkota & Associates portal</p>
                </div>

                <div className="space-y-5">
                    <div className="border-b border-[var(--border)] pb-3">
                        <h2 className="text-sm font-semibold text-[var(--text-heading)] flex items-center gap-2">
                            <UserCircle2 size={16} className="text-[var(--accent)]" />
                            Identity & profile details
                        </h2>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">Verify how you appear to clients and team members</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-[var(--text-body)]">Full legal name</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={15} />
                                <input 
                                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="Your Full Name"
                                    value={formData.displayName}
                                    onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-[var(--text-body)]">Contact phone number</label>
                            <div className="relative">
                                <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={15} />
                                <input 
                                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="e.g. 9800000000"
                                    value={formData.phoneNumber}
                                    onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-[var(--text-body)]">Assigned email address</label>
                            <input 
                                className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-xs text-[var(--text-muted)] opacity-60 cursor-not-allowed"
                                value={user?.email || ''}
                                disabled
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button 
                            onClick={handleComplete}
                            disabled={loading}
                            className="w-full h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Finalize workspace</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingPage;
