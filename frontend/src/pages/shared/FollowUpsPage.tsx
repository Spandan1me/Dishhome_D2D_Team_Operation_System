import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import {
  CalendarClock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Phone,
  ClipboardList,
  RefreshCw,
  Search,
  Check
} from 'lucide-react';

export const FollowUpsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [filter, setFilter] = useState<string>(searchParams.get('filter') || 'today');
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchFollowups = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filter && filter !== 'all') {
        params.filter = filter;
      }
      const res = await api.get('/followups/', { params });
      setFollowups(res.data.results || res.data || []);
    } catch (e) {
      console.error('Error fetching follow-ups', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowups();
  }, [filter]);

  const handleMarkComplete = async (id: number) => {
    try {
      setUpdatingId(id);
      await api.patch(`/followups/${id}/status/`, {
        status: 'COMPLETED',
        notes: 'Marked as completed from follow-up manager.',
      });
      fetchFollowups();
    } catch (e) {
      alert('Failed to update follow-up status.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-surface p-5 rounded-card-md shadow-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Follow-up Management</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Track customer commitments, callback requests, and overdue follow-ups.
          </p>
        </div>

        <button
          onClick={fetchFollowups}
          className="p-2 text-text-secondary hover:text-brand-red-dark bg-gray-50 rounded-lg border border-border"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface rounded-t-card-md px-4 pt-2 gap-2 overflow-x-auto">
        {[
          { key: 'today', label: "Today's Follow-ups", icon: Clock },
          { key: 'overdue', label: 'Overdue Follow-ups', icon: AlertTriangle },
          { key: 'upcoming', label: 'Upcoming', icon: Calendar },
          { key: 'completed', label: 'Completed', icon: CheckCircle2 },
          { key: 'all', label: 'All Follow-ups', icon: CalendarClock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-brand-red text-brand-red font-bold'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* List Card */}
      <div className="bg-surface rounded-card-md shadow-card border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-text-secondary">Loading follow-ups...</div>
        ) : followups.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-secondary">
            No follow-ups found in this category.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {followups.map((fu) => (
              <div
                key={fu.id}
                className="p-4 hover:bg-brand-red-light/20 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm font-mono text-brand-red-dark">
                      {fu.customer_code}
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {fu.customer_name || 'Name Unknown'}
                    </span>
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

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                    <span>Due: <strong className="text-text-primary">{fu.follow_up_date}</strong></span>
                    {fu.phone_number && (
                      <a href={`tel:${fu.phone_number}`} className="flex items-center gap-1 text-blue-600 font-mono font-medium hover:underline">
                        <Phone className="w-3 h-3" />
                        <span>{fu.phone_number}</span>
                      </a>
                    )}
                    <span>Assigned: <strong>{fu.agent_name}</strong></span>
                    {fu.remark && <span>Visit finding: <em>{fu.remark}</em></span>}
                  </div>

                  {fu.notes && (
                    <p className="text-xs text-text-primary bg-gray-50 p-2 rounded border border-border/70 mt-1 max-w-xl">
                      {fu.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {fu.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleMarkComplete(fu.id)}
                      disabled={updatingId === fu.id}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-success text-xs font-bold rounded-lg border border-emerald-300 transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Done</span>
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/visits/new?customer=${fu.customer}`)}
                    className="px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-lg shadow-sm flex items-center gap-1.5"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>Record Visit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
