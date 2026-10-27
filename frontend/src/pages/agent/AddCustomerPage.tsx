import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  UserPlus,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  ClipboardList
} from 'lucide-react';

export const AddCustomerPage: React.FC = () => {
  const navigate = useNavigate();

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [churnDays, setChurnDays] = useState('0');
  const [packagePlan, setPackagePlan] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCustomer, setCreatedCustomer] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId.trim()) {
      setError('Customer ID is required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        customer_id: customerId.trim().toUpperCase(),
        customer_name: customerName.trim(),
        phone_number: phoneNumber.trim(),
        churn_days: parseInt(churnDays) || 0,
        package: packagePlan.trim(),
        additional_notes: notes.trim(),
      };

      const res = await api.post('/customers/manual/', payload);
      setCreatedCustomer(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.customer_id?.[0] ||
                  err.response?.data?.detail ||
                  'Failed to add customer. Please verify details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Add Customer Manually</h2>
          <p className="text-xs text-text-secondary">
            Field entry for customers not found in uploaded supervisor list. Will be submitted for supervisor review.
          </p>
        </div>
      </div>

      {createdCustomer ? (
        <div className="bg-surface rounded-card-md p-8 shadow-card border border-border text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-success flex items-center justify-center">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-text-primary">
            Customer Added Successfully!
          </h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Customer <strong>{createdCustomer.customer_id}</strong> is assigned to you and has been marked as <strong>Pending Supervisor Review</strong>.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate(`/visits/new?customer=${createdCustomer.id}`)}
              className="w-full sm:w-auto px-6 py-3 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-lg shadow flex items-center justify-center gap-2"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Record Visit Now</span>
            </button>
            <button
              onClick={() => navigate('/agent/dashboard')}
              className="w-full sm:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 text-text-primary text-xs font-bold uppercase rounded-lg"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-card-md shadow-card border border-border p-6 md:p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-danger text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                DishHome Customer ID *
              </label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="e.g. DH10099"
                className="w-full px-4 py-3 bg-input-bg border-b-2 border-input-focus rounded-t-md text-sm font-mono font-bold text-text-primary focus:outline-none"
                required
              />
              <p className="text-[11px] text-text-secondary mt-1">
                Look up the Customer ID in the DishHome internal application if needed.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Customer Name (Optional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Ram Bahadur"
                  className="w-full px-4 py-3 bg-input-bg border-b-2 border-input-focus rounded-t-md text-sm text-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 98XXXXXXXX"
                  className="w-full px-4 py-3 bg-input-bg border-b-2 border-input-focus rounded-t-md text-sm text-text-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  No. of Churn Days (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={churnDays}
                  onChange={(e) => setChurnDays(e.target.value)}
                  className="w-full px-4 py-3 bg-input-bg border-b-2 border-input-focus rounded-t-md text-sm text-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Package / Plan (Optional)
                </label>
                <input
                  type="text"
                  value={packagePlan}
                  onChange={(e) => setPackagePlan(e.target.value)}
                  placeholder="e.g. 200 Mbps"
                  className="w-full px-4 py-3 bg-input-bg border-b-2 border-input-focus rounded-t-md text-sm text-text-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                Field Notes / Context (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason customer was added, field address, or location notes..."
                rows={3}
                className="w-full px-4 py-3 bg-input-bg border-b-2 border-input-focus rounded-t-md text-sm text-text-primary focus:outline-none resize-none"
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-5 py-3 text-xs font-semibold text-text-secondary hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-lg shadow-md transition-all flex items-center gap-2 disabled:opacity-50 min-h-[48px]"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Add & Assign Customer</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
