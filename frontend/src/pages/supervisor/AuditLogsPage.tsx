import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Filter,
  User,
  Clock
} from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (actionFilter) params.action = actionFilter;

      const res = await api.get('/audit/', { params });
      setLogs(res.data.results || res.data || []);
    } catch (e) {
      console.error('Error fetching audit logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-surface p-6 rounded-card-md shadow-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Operational Audit Trail</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Immutable system logs of logins, Excel uploads, customer allocations, reassignments, and visit findings.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2 text-text-secondary hover:text-brand-red-dark bg-gray-50 rounded-lg border border-border"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface p-4 rounded-card-md shadow-card border border-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit reason or user..."
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-border rounded-lg text-xs focus:outline-none focus:border-brand-red"
          />
        </form>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-border rounded-lg text-xs focus:outline-none w-full sm:w-auto"
        >
          <option value="">All Actions</option>
          <option value="LOGIN">LOGIN</option>
          <option value="LOGOUT">LOGOUT</option>
          <option value="IMPORT">IMPORT (Excel)</option>
          <option value="ALLOCATE">ALLOCATE (Customer)</option>
          <option value="REASSIGN">REASSIGN (Customer)</option>
          <option value="VISIT_COMPLETE">VISIT_COMPLETE</option>
          <option value="STATUS_CHANGE">STATUS_CHANGE</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-surface rounded-card-md shadow-card border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-text-secondary">Loading audit trail...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-secondary">No audit logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-text-secondary uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-brand-red-light/20">
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      {log.user_name || log.username || 'System'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action === 'LOGIN' ? 'bg-blue-100 text-blue-700' :
                        log.action === 'IMPORT' ? 'bg-purple-100 text-purple-700' :
                        log.action === 'ALLOCATE' || log.action === 'REASSIGN' ? 'bg-amber-100 text-warning' :
                        log.action === 'VISIT_COMPLETE' ? 'bg-emerald-100 text-success' :
                        'bg-gray-100 text-text-primary'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">
                      {log.entity_type} {log.entity_id ? `(${log.entity_id})` : ''}
                    </td>
                    <td className="px-4 py-3 text-text-primary max-w-md">
                      {log.reason || '-'}
                    </td>
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
