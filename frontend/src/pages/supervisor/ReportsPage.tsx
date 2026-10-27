import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  FileSpreadsheet,
  Download,
  Filter,
  BarChart3,
  Users,
  ClipboardList,
  UserCheck,
  TrendingDown,
  RefreshCw,
  Loader2
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<'allocations' | 'visits' | 'agents' | 'churn'>('allocations');
  const [reportData, setReportData] = useState<any[]>([]);
  const [churnStats, setChurnStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      if (activeReport === 'allocations') {
        const res = await api.get('/reports/allocations/');
        setReportData(res.data);
      } else if (activeReport === 'visits') {
        const res = await api.get('/reports/visits/');
        setReportData(res.data);
      } else if (activeReport === 'agents') {
        const res = await api.get('/reports/agents/');
        setReportData(res.data);
      } else if (activeReport === 'churn') {
        const res = await api.get('/reports/churn/');
        setChurnStats(res.data);
      }
    } catch (e) {
      console.error('Error fetching report', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeReport]);

  const handleDownload = async (format: 'excel' | 'csv') => {
    try {
      setExporting(true);
      const res = await api.get(`/reports/export/?report_type=${activeReport}&file_format=${format}`, {
        responseType: 'blob',
      });
      const ext = format === 'excel' ? 'xlsx' : 'csv';
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DishHome_D2D_${activeReport}_Report.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to download export file.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-surface p-6 rounded-card-md shadow-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Operations & Performance Reports</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Real-time backend reports with instant export to formatted Excel (.xlsx) and CSV files.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownload('excel')}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase rounded-lg shadow transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            <span>Export to Excel</span>
          </button>
          <button
            onClick={() => handleDownload('csv')}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-text-primary text-xs font-bold uppercase rounded-lg border border-border transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'allocations', label: 'Customer Allocations', desc: 'Assignments & Team Workload', icon: UserCheck },
          { key: 'visits', label: 'Visit Findings', desc: 'Field Findings & GPS Coordinates', icon: ClipboardList },
          { key: 'agents', label: 'Agent Performance', desc: 'Visits, Pending & Retention stats', icon: Users },
          { key: 'churn', label: 'Churn Analysis', desc: 'Reasons, Competitors & Churn Days', icon: TrendingDown },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeReport === item.key;
          return (
            <div
              key={item.key}
              onClick={() => setActiveReport(item.key as any)}
              className={`p-4 rounded-card-md border cursor-pointer transition-all ${
                isActive
                  ? 'bg-brand-red-light border-brand-red text-brand-red-dark shadow-sm'
                  : 'bg-surface border-border hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-1">
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-red' : 'text-text-secondary'}`} />
                <h4 className="text-xs font-bold uppercase">{item.label}</h4>
              </div>
              <p className="text-[11px] text-text-secondary">{item.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Report Content Table */}
      <div className="bg-surface rounded-card-md shadow-card border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50/50">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            {activeReport.replace('-', ' ')} Live Report Data
          </h3>
          <button
            onClick={fetchReportData}
            className="p-1.5 text-text-secondary hover:text-brand-red-dark rounded-md"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-text-secondary">Generating report from database...</div>
        ) : activeReport === 'churn' && churnStats ? (
          <div className="p-6 space-y-6 text-xs">
            {/* Churn Bracket Cards */}
            <div>
              <h4 className="font-bold text-text-secondary uppercase mb-3">Customer Distribution by Churn Days</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {churnStats.churn_brackets?.map((br: any, idx: number) => (
                  <div key={idx} className="p-3 bg-gray-50 border border-border rounded-lg text-center">
                    <span className="text-text-secondary font-medium">{br.bracket}</span>
                    <p className="text-xl font-bold text-brand-red mt-1">{br.count}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Switching Reasons Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-bold text-text-secondary uppercase mb-2">Switching Reasons</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-100 uppercase text-[10px] text-text-secondary">
                      <tr>
                        <th className="p-2.5">Reason</th>
                        <th className="p-2.5 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {churnStats.switching_reasons?.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="p-2.5 font-medium">{item.switching_reason}</td>
                          <td className="p-2.5 text-right font-bold text-brand-red">{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-text-secondary uppercase mb-2">Competitor ISPs (Switched To)</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-100 uppercase text-[10px] text-text-secondary">
                      <tr>
                        <th className="p-2.5">Competitor ISP</th>
                        <th className="p-2.5 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {churnStats.competitor_isps?.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="p-2.5 font-medium">{item.switching_to}</td>
                          <td className="p-2.5 text-right font-bold text-brand-red">{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : reportData.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-secondary">No records found for this report.</div>
        ) : activeReport === 'allocations' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-text-secondary uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">Customer ID</th>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Churn Days</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Assigned Agent</th>
                  <th className="px-4 py-3">Assigned On</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-brand-red-light/20">
                    <td className="px-4 py-2.5 font-bold font-mono text-brand-red-dark">{row.customer_id}</td>
                    <td className="px-4 py-2.5 font-medium">{row.customer_name}</td>
                    <td className="px-4 py-2.5 font-mono">{row.phone_number}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{row.churn_days}</td>
                    <td className="px-4 py-2.5">{row.package}</td>
                    <td className="px-4 py-2.5 font-semibold text-text-primary">{row.assigned_agent}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{row.assigned_at}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-success">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeReport === 'visits' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-text-secondary uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">Customer ID</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Follow-up Remark</th>
                  <th className="px-4 py-3">Switching Reason</th>
                  <th className="px-4 py-3">Switching To</th>
                  <th className="px-4 py-3">GPS Location</th>
                  <th className="px-4 py-3">Completed On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-brand-red-light/20">
                    <td className="px-4 py-2.5 font-bold font-mono text-brand-red-dark">{row.customer_id}</td>
                    <td className="px-4 py-2.5 font-semibold">{row.agent_name}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-success">
                        {row.visit_status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-text-primary">{row.follow_up_remark}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{row.switching_reason || '-'}</td>
                    <td className="px-4 py-2.5 font-semibold text-danger">{row.switching_to || '-'}</td>
                    <td className="px-4 py-2.5 text-[11px] font-mono">
                      {row.gps_latitude ? `${row.gps_latitude}, ${row.gps_longitude}` : <em className="text-text-secondary">No GPS</em>}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{row.completed_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-text-secondary uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">Agent Name</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3 text-center">Assigned</th>
                  <th className="px-4 py-3 text-center">Unique Visited</th>
                  <th className="px-4 py-3 text-center">Total Visits</th>
                  <th className="px-4 py-3 text-center">Pending</th>
                  <th className="px-4 py-3 text-center">GPS Visits</th>
                  <th className="px-4 py-3 text-center">Manual Adds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-brand-red-light/20">
                    <td className="px-4 py-2.5 font-bold text-text-primary">{row.agent_name}</td>
                    <td className="px-4 py-2.5 font-mono text-text-secondary">{row.username}</td>
                    <td className="px-4 py-2.5 text-center font-bold">{row.assigned_count}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-success">{row.unique_visited}</td>
                    <td className="px-4 py-2.5 text-center font-medium">{row.total_visits}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-warning">{row.pending_customers}</td>
                    <td className="px-4 py-2.5 text-center font-medium">{row.gps_captured_visits}</td>
                    <td className="px-4 py-2.5 text-center font-medium text-purple-700">{row.agent_added_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
