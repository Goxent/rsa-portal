
import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { UserCog, Save, LogOut } from 'lucide-react';

const ProfileSetupPage: React.FC = () => {
  const { user, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    phoneNumber: user?.phoneNumber || ''
  });
  const [loading, setLoading] = useState(false);

  // If user is already set up, redirect to dashboard (declarative — avoids render-phase navigate() warning)
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
      await refreshProfile();
      navigate('/dashboard');
    } catch (error) {
      console.error("Setup failed", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md p-8 rounded-2xl shadow-2xl border border-white/10">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-blue-600/20 rounded-xl text-blue-400">
            <UserCog size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Complete Profile</h2>
            <p className="text-sm text-gray-400">One-time setup for R. Sapkota & Assoc.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Full Name *</label>
            <input
              required
              className="w-full glass-input rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Ram Kumar"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number *</label>
            <input
              required
              type="tel"
              className="w-full glass-input rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 9800000000"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            />
          </div>

          <div className="pt-4 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/40 flex justify-center items-center"
            >
              {loading ? 'Saving...' : <><Save size={18} className="mr-2" /> Save & Continue</>}
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="w-full text-gray-500 hover:text-white text-sm py-2 flex justify-center items-center"
            >
              <LogOut size={14} className="mr-1" /> Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetupPage;
