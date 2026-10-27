import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Users,
  UserCheck,
  UserX,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserPlus,
  MapPin,
  MapPinOff,
  TrendingUp,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const PALETTE = ['#E31E24', '#F9A825', '#2E7D32', '#00BCD4', '#5F6368', '#AB47BC', '#FF7043', '#26A69A'];

export const SupervisorDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/dashboard/');
      setData(res.data);
    } catch (e) {
      console.error('Error fetching dashboard stats', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-red"></div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-4 rounded-card-md shadow-card border border-border">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Operations Overview</h2>
          <p className="text-xs text-text-secondary">Real-time field operations, customer assignments, and visit metrics.</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-brand-red-dark bg-gray-50 hover:bg-brand-red-light rounded-md border border-border transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <div
          onClick={() => navigate('/customers')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer hover:border-brand-red transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-secondary">Total Customers</span>
            <div className="w-8 h-8 rounded-lg bg-brand-red-light text-brand-red flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-text-primary">{kpis.total_customers || 0}</p>
          <p className="text-[11px] text-text-secondary mt-1 flex items-center gap-1">
            <span>View all customer records</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        {/* Assigned Customers */}
        <div
          onClick={() => navigate('/customers?is_assigned=true')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer hover:border-brand-red transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-secondary">Assigned Customers</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-text-primary">{kpis.total_assigned || 0}</p>
          <p className="text-[11px] text-text-secondary mt-1">Allocated to field agents</p>
        </div>

        {/* Unassigned Customers */}
        <div
          onClick={() => navigate('/supervisor/allocation')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer hover:border-brand-red transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-secondary">Unassigned Customers</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-warning flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-warning">{kpis.unassigned_count || 0}</p>
          <p className="text-[11px] text-brand-red font-medium mt-1 flex items-center gap-1">
            <span>Allocate Team now</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        {/* Unique Customers Visited */}
        <div
          onClick={() => navigate('/visits')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer hover:border-brand-red transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-secondary">Unique Customers Visited</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-success flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-success">{kpis.unique_customers_visited || 0}</p>
          <p className="text-[11px] text-text-secondary mt-1">
            {kpis.completed_visits_count || 0} total visit logs
          </p>
        </div>

        {/* Follow-ups Due Today */}
        <div
          onClick={() => navigate('/followups?filter=today')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer hover:border-brand-red transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-secondary">Follow-ups Due Today</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-warning flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-warning">{kpis.followups_due_today || 0}</p>
          <p className="text-[11px] text-text-secondary mt-1">Scheduled for today</p>
        </div>

        {/* Overdue Follow-ups */}
        <div
          onClick={() => navigate('/followups?filter=overdue')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer hover:border-brand-red transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-danger">Overdue Follow-ups</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-danger flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-danger">{kpis.overdue_followups || 0}</p>
          <p className="text-[11px] text-danger font-medium mt-1">Requires supervisor attention</p>
        </div>

        {/* Agent-Added Pending Review */}
        <div
          onClick={() => navigate('/customers?record_source=AGENT_MANUAL&review_status=PENDING_REVIEW')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer hover:border-brand-red transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-secondary">Agent-Added Pending</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-600">{kpis.agent_added_pending || 0}</p>
          <p className="text-[11px] text-text-secondary mt-1">Awaiting approval</p>
        </div>

        {/* GPS Captured vs Missing */}
        <div
          onClick={() => navigate('/visits')}
          className="bg-surface p-4 rounded-card-md shadow-card border border-border cursor-pointer hover:border-brand-red transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-secondary">GPS Verification</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-success">{kpis.gps_captured_visits || 0}</span>
            <span className="text-xs text-text-secondary">with GPS</span>
            <span className="text-sm font-semibold text-danger">/ {kpis.missing_gps_visits || 0}</span>
          </div>
          <p className="text-[11px] text-text-secondary mt-1">Verified on completion</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Daily Visit Completion Trend */}
        <div className="bg-surface p-5 rounded-card-md shadow-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-text-primary uppercase flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-red" />
              <span>Daily Visit Completion Trend</span>
            </h3>
            <span className="text-[11px] text-text-secondary font-medium">Last 14 Days</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.daily_trend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F44336" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#F44336" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E0E0E0', fontSize: '12px' }} />
                <Area type="monotone" dataKey="visits" stroke="#E31E24" strokeWidth={2.5} fillOpacity={1} fill="url(#redGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Agent Performance (Assigned vs Completed) */}
        <div className="bg-surface p-5 rounded-card-md shadow-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-text-primary uppercase flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-brand-red" />
              <span>Agent Visit Performance</span>
            </h3>
            <span className="text-[11px] text-text-secondary font-medium">Active D2D Agents</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.agent_performance || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E0E0E0', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="assigned" name="Assigned" fill="#5F6368" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed Visits" fill="#E31E24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Follow-up Remarks Distribution */}
        <div className="bg-surface p-5 rounded-card-md shadow-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-text-primary uppercase">Follow-up Remarks Distribution</h3>
            <span className="text-[11px] text-text-secondary font-medium">Top Remarks</span>
          </div>
          <div className="h-64 w-full">
            {charts.remark_distribution && charts.remark_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.remark_distribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry: any) => `${(entry?.name || '').slice(0, 15)} (${entry?.value})`}
                    labelLine={false}
                  >
                    {charts.remark_distribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E0E0E0', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-text-secondary text-xs">
                No visit remark data yet
              </div>
            )}
          </div>
        </div>

        {/* 4. Switching Reasons & Competitor ISPs */}
        <div className="bg-surface p-5 rounded-card-md shadow-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-text-primary uppercase">Competitor ISP Switching</h3>
            <span className="text-[11px] text-text-secondary font-medium">Lost to Competitor</span>
          </div>
          <div className="h-64 w-full">
            {charts.isp_distribution && charts.isp_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.isp_distribution} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E0E0E0', fontSize: '12px' }} />
                  <Bar dataKey="value" name="Customers" fill="#E31E24" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-text-secondary text-xs">
                No competitor switching records yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
