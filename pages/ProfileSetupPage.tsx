import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { UserCog, Save, LogOut, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const ProfileSetupPage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    phoneNumber: user?.phoneNumber || ''
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    document.title = 'Profile Setup — RSA';
    return () => { document.title = 'RSA'; };
  }, []);

  if (user?.isSetupComplete) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      await AuthService.updateUserProfile(user.uid, {
        displayName: formData.displayName,
        phoneNumber: formData.phoneNumber,
        isSetupComplete: true
      });
      await refreshUser();
      toast.success("Profile completed successfully!");
      navigate('/dashboard');
    } catch (error: any) {
      console.error("Setup failed", error);
      toast.error(error.message || "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md bg-[var(--bg-surface)] p-8 md:p-10 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-[var(--accent-dim)] border border-[var(--border-accent)] rounded-xl text-[var(--accent)]">
            <UserCog size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-heading)]">Complete profile</h1>
            <p className="text-xs text-[var(--text-muted)] font-medium">One-time setup for R. Sapkota & Associates</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-body)]">Full name *</label>
            <input
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="e.g. Ram Kumar"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-body)]">Phone number *</label>
            <input
              required
              type="tel"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border)] text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="e.g. 9800000000"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            />
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><Save size={15} /> Save & continue</>}
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="w-full text-[var(--text-muted)] hover:text-[var(--text-heading)] text-xs font-medium py-2 flex justify-center items-center gap-1.5 transition-colors"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetupPage;
