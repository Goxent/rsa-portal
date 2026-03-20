import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PendingApprovalPage: React.FC = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-600/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="glass-panel max-w-md w-full p-8 rounded-2xl flex flex-col items-center text-center relative z-10 border border-white/10 shadow-2xl">
                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 border border-amber-500/20">
                    <ShieldAlert className="text-amber-500" size={40} />
                </div>

                <h1 className="text-2xl font-bold font-heading text-white mb-3">
                    Account Pending Approval
                </h1>

                <p className="text-slate-300 mb-6 text-sm leading-relaxed">
                    Hi {user?.displayName || 'there'}, your account has been created but your email (<strong>{user?.email}</strong>) was not found in the pre-approved Staff Directory.
                </p>

                <div className="bg-navy-800/50 p-4 rounded-xl border border-white/5 mb-8 w-full text-left">
                    <p className="text-xs text-slate-400 mb-2">
                        What happens next?
                    </p>
                    <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
                        <li>An Administrator must review and approve your account.</li>
                        <li>Once approved, you will be granted access to the system.</li>
                        <li>If you believe this is an error, please contact your manager.</li>
                    </ul>
                </div>

                <div className="w-full">
                    <button
                        onClick={handleLogout}
                        className="w-full flex justify-center items-center py-3 px-4 rounded-xl border border-white/10 text-slate-300 bg-white/5 hover:bg-white/10 hover:text-white transition-all font-medium"
                    >
                        <LogOut size={18} className="mr-2" />
                        Log Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PendingApprovalPage;
