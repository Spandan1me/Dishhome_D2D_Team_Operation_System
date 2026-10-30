import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { VisitEvidencePreview } from '../../components/shared/VisitEvidencePreview';
import {
  Users,
  Phone,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  ClipboardList,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  UserCheck,
  History,
  ShieldCheck,
  CalendarClock,
  Trash2
} from 'lucide-react';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSupervisor, isAdmin } = useAuth();

  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviewAction, setReviewAction] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/customers/${id}/`);
      setCustomer(res.data);
    } catch (e) {
      console.error('Error fetching customer details', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetails();
  }, [id]);

  const handleReviewDecision = async (decision: 'APPROVE' | 'REJECT' | 'CORRECTION_REQUESTED') => {
    try {
      setActionLoading(true);
      await api.post(`/customers/${id}/review/`, {
        action: decision,
        review_notes: reviewNotes.trim(),
      });
      setReviewAction(null);
      setReviewNotes('');
      fetchCustomerDetails();
    } catch (e) {
      alert('Failed to update review status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteVisit = async (visit: any) => {
    if (!window.confirm(`Delete this visit log for customer ${customer.customer_id || customer.customer_name || 'this customer'}? This removes the mistaken visit record.`)) {
      return;
    }

    try {
      await api.delete(`/visits/${visit.id}/`);
      setCustomer((current: any) => ({
        ...current,
        visits: (current?.visits || []).filter((item: any) => item.id !== visit.id),
      }));
    } catch (e) {
      console.error('Failed to delete visit log', e);
      alert('Unable to delete this visit log.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-red"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center text-xs text-text-secondary">Customer record not found.</div>
    );
  }

  const visits = customer.visits || [];
  const followups = customer.followups || [];
  const assignmentHistory = customer.assignment_history || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono text-brand-red-dark">{customer.customer_id}</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                customer.review_status === 'APPROVED'
                  ? 'bg-emerald-100 text-success'
                  : customer.review_status === 'PENDING_REVIEW'
                  ? 'bg-amber-100 text-warning'
                  : 'bg-red-100 text-danger'
              }`}>
                {customer.review_status}
              </span>
            </div>
            <p className="text-sm font-semibold text-text-primary">{customer.customer_name || 'Name Unknown'}</p>
          </div>
        </div>

        <button
          onClick={() => navigate(`/visits/new?customer=${customer.id}`)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-lg shadow transition-all"
        >
          <ClipboardList className="w-4 h-4" />
          <span>Record Visit</span>
        </button>
      </div>

      {/* Supervisor Review Banner for Manual Adds */}
      {(isSupervisor || isAdmin) && customer.record_source === 'AGENT_MANUAL' && customer.review_status === 'PENDING_REVIEW' && (
        <div className="bg-amber-50 border-2 border-warning/60 rounded-card-md p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-warning font-bold text-sm uppercase">
            <ShieldCheck className="w-5 h-5" />
            <span>Agent-Added Customer Awaiting Supervisor Review</span>
          </div>
          <p className="text-xs text-text-secondary">
            This customer was manually added by agent <strong>{customer.created_by_name}</strong>.
            Review the customer details and choose to approve, reject, or request correction.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => handleReviewDecision('APPROVE')}
              disabled={actionLoading}
              className="px-4 py-2 bg-success text-white text-xs font-bold uppercase rounded-md shadow hover:bg-emerald-700 transition-colors"
            >
              Approve Customer
            </button>
            <button
              onClick={() => setReviewAction('REJECT')}
              disabled={actionLoading}
              className="px-4 py-2 bg-danger text-white text-xs font-bold uppercase rounded-md shadow hover:bg-red-700 transition-colors"
            >
              Reject Customer
            </button>
            <button
              onClick={() => setReviewAction('CORRECTION_REQUESTED')}
              disabled={actionLoading}
              className="px-4 py-2 bg-amber-500 text-white text-xs font-bold uppercase rounded-md shadow hover:bg-amber-600 transition-colors"
            >
              Request Correction
            </button>
          </div>

          {reviewAction && (
            <div className="pt-2 space-y-2">
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Supervisor review comments or correction details..."
                rows={2}
                className="w-full p-2.5 text-xs bg-white border border-border rounded-lg focus:outline-none resize-none"
              />
              <button
                onClick={() => handleReviewDecision(reviewAction as any)}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-text-primary text-white text-xs font-bold uppercase rounded-md"
              >
                Confirm {reviewAction}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="bg-surface rounded-card-md p-6 shadow-card border border-border">
        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">
          Customer Profile Information
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-text-secondary block mb-0.5">Phone Number:</span>
            {customer.phone_number ? (
              <a href={`tel:${customer.phone_number}`} className="font-bold text-blue-600 hover:underline flex items-center gap-1 font-mono">
                <Phone className="w-3.5 h-3.5" />
                <span>{customer.phone_number}</span>
              </a>
            ) : (
              <span className="text-text-secondary italic">Not Provided</span>
            )}
          </div>

          <div>
            <span className="text-text-secondary block mb-0.5">No. of Churn Days:</span>
            <span className="font-bold text-base text-text-primary">{customer.churn_days} days</span>
          </div>

          <div>
            <span className="text-text-secondary block mb-0.5">Internet Package:</span>
            <span className="font-semibold text-text-primary">{customer.package || 'Standard Plan'}</span>
          </div>

          <div>
            <span className="text-text-secondary block mb-0.5">Record Source:</span>
            <span className="font-semibold text-text-primary">
              {customer.record_source === 'AGENT_MANUAL' ? 'Agent Manual Entry' : 'Excel Import'}
            </span>
          </div>

          <div>
            <span className="text-text-secondary block mb-0.5">Assigned Agent:</span>
            <span className="font-bold text-text-primary">
              {customer.assigned_agent_name || <em className="text-text-secondary font-normal">Unassigned</em>}
            </span>
          </div>

          <div>
            <span className="text-text-secondary block mb-0.5">Created By:</span>
            <span className="text-text-primary">{customer.created_by_name || 'System / Excel'}</span>
          </div>

          <div>
            <span className="text-text-secondary block mb-0.5">Created On:</span>
            <span className="text-text-primary">{new Date(customer.created_at).toLocaleDateString()}</span>
          </div>

          <div>
            <span className="text-text-secondary block mb-0.5">Last Updated:</span>
            <span className="text-text-primary">{new Date(customer.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        {customer.review_notes && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs border border-border">
            <span className="font-bold text-text-secondary block mb-0.5">Notes:</span>
            <p className="text-text-primary whitespace-pre-wrap">{customer.review_notes}</p>
          </div>
        )}
      </div>

      {/* Historical Visits Timeline */}
      <div className="bg-surface rounded-card-md p-6 shadow-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-brand-red" />
            <span>Visit History ({visits.length})</span>
          </h3>
          <button
            onClick={() => navigate(`/visits/new?customer=${customer.id}`)}
            className="text-xs text-link font-semibold hover:underline"
          >
            + Record New Visit
          </button>
        </div>

        {visits.length === 0 ? (
          <p className="text-xs text-text-secondary py-4 italic">No visits have been recorded for this customer yet.</p>
        ) : (
          <div className="space-y-4">
            {visits.map((v: any) => (
              <div key={v.id} className="p-4 rounded-xl border border-border bg-gray-50/50 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      v.visit_status === 'COMPLETED' ? 'bg-emerald-100 text-success' : 'bg-amber-100 text-warning'
                    }`}>
                      {v.visit_status}
                    </span>
                    <span className="font-bold text-xs text-text-primary">{v.follow_up_remark}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-secondary font-medium">
                      Visited by {v.agent_name} on {v.completed_at ? new Date(v.completed_at).toLocaleString() : 'N/A'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteVisit(v)}
                      className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-danger hover:bg-red-100 transition-colors"
                      title="Delete this visit log"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {v.switching_to && (
                  <p className="text-xs text-danger font-medium">
                    Switching to: <strong>{v.switching_to}</strong>
                    {v.switching_reason && ` | Reason: ${v.switching_reason}`}
                  </p>
                )}

                {v.notes && (
                  <p className="text-xs text-text-primary whitespace-pre-wrap">{v.notes}</p>
                )}

                {(v.has_photo || v.has_video) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {v.has_photo && <VisitEvidencePreview visitId={v.id} evidenceType="photo" />}
                    {v.has_video && <VisitEvidencePreview visitId={v.id} evidenceType="video" />}
                  </div>
                )}

                {/* GPS Coordinates Badge & External Map Link */}
                {v.gps_latitude && v.gps_longitude ? (
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-teal-800">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    <span>GPS: {v.gps_latitude}, {v.gps_longitude} (±{v.gps_accuracy}m)</span>
                    <a
                      href={`https://www.google.com/maps?q=${v.gps_latitude},${v.gps_longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link hover:underline flex items-center gap-0.5 font-medium ml-1"
                    >
                      <span>Open Map</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <span className="text-[10px] text-text-secondary italic">No GPS coordinates recorded</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Follow-ups List */}
      <div className="bg-surface rounded-card-md p-6 shadow-card border border-border">
        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-warning" />
          <span>Scheduled Follow-ups ({followups.length})</span>
        </h3>

        {followups.length === 0 ? (
          <p className="text-xs text-text-secondary py-2 italic">No follow-ups scheduled.</p>
        ) : (
          <div className="divide-y divide-border">
            {followups.map((fu: any) => (
              <div key={fu.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-text-primary">Due: {fu.follow_up_date}</span>
                  {fu.notes && <p className="text-text-secondary mt-0.5">{fu.notes}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  fu.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-success'
                    : fu.status === 'OVERDUE'
                    ? 'bg-red-100 text-danger'
                    : 'bg-amber-100 text-warning'
                }`}>
                  {fu.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
