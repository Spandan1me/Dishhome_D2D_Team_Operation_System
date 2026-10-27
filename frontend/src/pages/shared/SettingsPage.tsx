import React, { useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Settings, Lock, CheckCircle, AlertCircle, Loader2, User } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      await api.post('/auth/password/change/', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setSuccess('Your password has been changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.old_password?.[0] ||
                  err.response?.data?.detail ||
                  'Failed to change password. Please verify current password.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* User Profile Card */}
      <div className="bg-surface rounded-card-md p-6 shadow-card border border-border">
        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-brand-red" />
          <span>My User Profile</span>
        </h3>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-text-secondary block mb-0.5">Full Name:</span>
            <strong className="text-text-primary text-sm">{user?.full_name || 'N/A'}</strong>
          </div>
          <div>
            <span className="text-text-secondary block mb-0.5">Username:</span>
            <span className="font-mono text-text-primary text-sm">{user?.username}</span>
          </div>
          <div>
            <span className="text-text-secondary block mb-0.5">Role:</span>
            <span className="font-bold text-brand-red uppercase">{user?.role}</span>
          </div>
          <div>
            <span className="text-text-secondary block mb-0.5">Phone:</span>
            <span className="text-text-primary">{user?.phone_number || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-surface rounded-card-md p-6 shadow-card border border-border">
        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-brand-red" />
          <span>Change Password</span>
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-danger text-xs rounded-lg flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-success text-xs rounded-lg flex items-center gap-2 font-semibold">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-text-secondary uppercase mb-1">
              Current Password *
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-input-bg border-b-2 border-input-focus rounded-t-md text-text-primary focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-text-secondary uppercase mb-1">
              New Password *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-input-bg border-b-2 border-input-focus rounded-t-md text-text-primary focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-text-secondary uppercase mb-1">
              Confirm New Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-input-bg border-b-2 border-input-focus rounded-t-md text-text-primary focus:outline-none"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white font-bold uppercase rounded-md shadow transition-all flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Password</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
