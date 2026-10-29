import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { VisitEvidencePreview } from '../../components/shared/VisitEvidencePreview';
import {
  ClipboardList,
  MapPin,
  ExternalLink,
  Search,
  RefreshCw,
  Filter,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';

export const VisitHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [hasGpsFilter, setHasGpsFilter] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const formatVisitCopyText = (visit: any) => {
    const gpsText = visit.gps_latitude && visit.gps_longitude
      ? `${Number(visit.gps_latitude).toFixed(6)}, ${Number(visit.gps_longitude).toFixed(6)}`
      : 'N/A';

    return [
      `Customer id: ${visit.customer_code || 'N/A'}`,
      `Phone number: ${visit.phone_number || 'N/A'}`,
      `Customer gps: ${gpsText}`,
      `Churn Days: ${visit.churn_days ?? 'N/A'}`,
      `Follow up remarks: ${visit.follow_up_remark || 'N/A'}`,
      `Note: ${visit.notes || 'N/A'}`,
    ].join('\n');
  };

  const handleCopyVisitSummary = async (visit: any) => {
    try {
      await navigator.clipboard.writeText(formatVisitCopyText(visit));
      setCopiedId(visit.id);
      window.setTimeout(() => setCopiedId((current) => (current === visit.id ? null : current)), 1500);
    } catch (error) {
      console.error('Failed to copy visit summary', error);
    }
  };

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (hasGpsFilter) params.has_gps = hasGpsFilter;

      const res = await api.get('/visits/', { params });
      setVisits(res.data.results || res.data || []);
    } catch (e) {
      console.error('Error fetching visit logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, [statusFilter, hasGpsFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-surface p-6 rounded-card-md shadow-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Visit Findings & GPS Logs</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Historical log of field agent customer visits, follow-up remarks, competitor ISP migrations, and verified GPS coordinates.
          </p>
        </div>

        <button
          onClick={fetchVisits}
          className="p-2 text-text-secondary hover:text-brand-red-dark bg-gray-50 rounded-lg border border-border"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface p-4 rounded-card-md shadow-card border border-border flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-border rounded-lg text-xs focus:outline-none"
        >
          <option value="">All Visit Statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="CUSTOMER_NOT_FOUND">Customer Not Found</option>
          <option value="UNABLE_TO_REACH">Unable to Reach</option>
          <option value="FOLLOW_UP_REQUIRED">Follow-up Required</option>
        </select>

        <select
          value={hasGpsFilter}
          onChange={(e) => setHasGpsFilter(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-border rounded-lg text-xs focus:outline-none"
        >
          <option value="">All GPS Statuses</option>
          <option value="true">With GPS Coordinates</option>
          <option value="false">Missing GPS</option>
        </select>
      </div>

      {/* Visit Logs Table */}
      <div className="bg-surface rounded-card-md shadow-card border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-text-secondary">Loading visit logs...</div>
        ) : visits.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-secondary">No visit records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-text-secondary uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">Customer ID</th>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Visited By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Follow-up Remark</th>
                  <th className="px-4 py-3">Switching Details</th>
                  <th className="px-4 py-3">GPS Location</th>
                  <th className="px-4 py-3">Evidence</th>
                  <th className="px-4 py-3">Completed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visits.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => navigate(`/customers/${v.customer}`)}
                    className="hover:bg-brand-red-light/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-bold font-mono text-brand-red-dark">
                      {v.customer_code}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      {v.customer_name || 'N/A'}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {v.agent_name || v.agent_username}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        v.visit_status === 'COMPLETED' ? 'bg-emerald-100 text-success' : 'bg-amber-100 text-warning'
                      }`}>
                        {v.visit_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {v.follow_up_remark}
                    </td>
                    <td className="px-4 py-3">
                      {v.switching_to ? (
                        <span className="font-semibold text-danger">
                          {v.switching_to} {v.switching_reason ? `(${v.switching_reason})` : ''}
                        </span>
                      ) : (
                        <span className="text-text-secondary">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {v.gps_latitude && v.gps_longitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${v.gps_latitude},${v.gps_longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-teal-800 hover:underline font-mono text-[11px]"
                        >
                          <MapPin className="w-3.5 h-3.5 text-teal-600" />
                          <span>{Number(v.gps_latitude).toFixed(4)}, {Number(v.gps_longitude).toFixed(4)}</span>
                          <ExternalLink className="w-3 h-3 text-text-secondary" />
                        </a>
                      ) : (
                        <span className="text-text-secondary italic text-[11px]">No GPS</span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1.5">
                        {v.has_photo && <VisitEvidencePreview visitId={v.id} evidenceType="photo" />}
                        {v.has_video && <VisitEvidencePreview visitId={v.id} evidenceType="video" />}
                        {!v.has_photo && !v.has_video && <span className="text-text-secondary">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary font-mono" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between gap-2">
                        <span>{v.completed_at ? new Date(v.completed_at).toLocaleString() : 'N/A'}</span>
                        {v.visit_status === 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyVisitSummary(v);
                            }}
                            className="inline-flex items-center gap-1 rounded border border-border bg-gray-50 px-2 py-1 text-[10px] font-semibold text-text-primary hover:bg-brand-red-light/30 transition-colors"
                            title="Copy visit summary"
                          >
                            {copiedId === v.id ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === v.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        )}
                      </div>
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
