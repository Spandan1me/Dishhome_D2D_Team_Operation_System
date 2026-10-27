import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Users,
  Clock,
  CheckCircle2,
  CalendarClock,
  AlertTriangle,
  PlusCircle,
  Search,
  Phone,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  MapPin
} from 'lucide-react';

export const AgentDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAgentData = async () => {
    try {
      setLoading(true);
      const [statsRes, custRes] = await Promise.all([
        api.get('/reports/dashboard/'),
        api.get('/customers/'),
      ]);
      setStats(statsRes.data);
      setCustomers(custRes.data.results || custRes.data || []);
    } catch (e) {
      console.error('Error loading agent dashboard', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentData();
  }, []);

  const filteredCustomers = customers.filter(c =>
    (c.customer_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone_number || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Quick Action Top Bar */}
      <div className="flex items-center justify-between gap-3 bg-surface p-4 rounded-card-md shadow-card border border-border">
        <div>
          <h2 className="text-base font-bold text-text-primary">D2D Field Dashboard</h2>
          <p className="text-xs text-text-secondary">Assigned customer visits & active follow-ups</p>
        </div>
        <button
          onClick={() => navigate('/customers/new')}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-lg shadow transition-all shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Summary Touch Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div
          onClick={() => navigate('/customers')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-medium">Assigned</span>
            <Users className="w-4 h-4 text-brand-red" />
          </div>
          <p className="text-2xl font-bold text-text-primary">{stats?.total_assigned || 0}</p>
        </div>

        <div
          onClick={() => navigate('/customers?visit_status=PENDING')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-medium">Pending Visits</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <p className="text-2xl font-bold text-warning">{stats?.pending_visits || 0}</p>
        </div>

        <div
          onClick={() => navigate('/visits')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-medium">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <p className="text-2xl font-bold text-success">{stats?.completed_visits || 0}</p>
        </div>

        <div
          onClick={() => navigate('/followups?filter=today')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-medium">Due Today</span>
            <CalendarClock className="w-4 h-4 text-warning" />
          </div>
          <p className="text-2xl font-bold text-warning">{stats?.followups_today || 0}</p>
        </div>

        <div
          onClick={() => navigate('/followups?filter=overdue')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-medium text-danger">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-danger" />
          </div>
          <p className="text-2xl font-bold text-danger">{stats?.overdue_followups || 0}</p>
        </div>

        <div
          onClick={() => navigate('/customers?record_source=AGENT_MANUAL')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-medium">My Manual Adds</span>
            <PlusCircle className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-purple-600">{stats?.agent_added_count || 0}</p>
        </div>
      </div>

      {/* Assigned Customers Section */}
      <div className="bg-surface rounded-card-md shadow-card border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-50/50">
          <div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
              My Assigned Customers
            </h3>
            <p className="text-xs text-text-secondary">Open customer card to record visit findings & GPS</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search assigned customer..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-border rounded-lg text-xs focus:outline-none focus:border-brand-red"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-text-secondary">Loading customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-secondary">
            No assigned customers found matching your criteria.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredCustomers.map((cust) => (
              <div
                key={cust.id}
                className="p-4 hover:bg-brand-red-light/20 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm font-mono text-brand-red-dark">
                      {cust.customer_id}
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {cust.customer_name || 'Name Unknown'}
                    </span>
                    {cust.record_source === 'AGENT_MANUAL' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700">
                        Manual Add
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                    {cust.phone_number && (
                      <a
                        href={`tel:${cust.phone_number}`}
                        className="flex items-center gap-1 text-blue-600 font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="w-3 h-3" />
                        <span>{cust.phone_number}</span>
                      </a>
                    )}
                    <span>Churn: <strong className="text-text-primary">{cust.churn_days} days</strong></span>
                    <span>Package: <strong className="text-text-primary">{cust.package || 'Standard'}</strong></span>
                  </div>

                  {cust.latest_visit_status && (
                    <div className="pt-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        cust.latest_visit_status === 'COMPLETED' ? 'bg-emerald-100 text-success' : 'bg-amber-100 text-warning'
                      }`}>
                        Latest Visit: {cust.latest_visit_status}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => navigate(`/visits/new?customer=${cust.id}`)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>Record Visit</span>
                  </button>
                  <button
                    onClick={() => navigate(`/customers/${cust.id}`)}
                    className="p-2.5 text-text-secondary hover:text-text-primary bg-gray-50 rounded-lg border border-border min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="View Details"
                  >
                    <ChevronRight className="w-5 h-5" />
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
