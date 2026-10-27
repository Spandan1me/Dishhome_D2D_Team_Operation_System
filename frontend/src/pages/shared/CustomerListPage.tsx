import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import {
  Users,
  Search,
  Filter,
  PlusCircle,
  Phone,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const CustomerListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAgent, isSupervisor, isAdmin } = useAuth();

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Filters
  const [search, setSearch] = useState('');
  const [recordSource, setRecordSource] = useState(searchParams.get('record_source') || '');
  const [reviewStatus, setReviewStatus] = useState(searchParams.get('review_status') || '');
  const [assignedFilter, setAssignedFilter] = useState(searchParams.get('is_assigned') || '');
  const [ordering, setOrdering] = useState('-created_at');

  const fetchCustomers = async (page = currentPage) => {
    try {
      setLoading(true);
      const params: any = { page };
      if (search.trim()) params.search = search.trim();
      if (recordSource) params.record_source = recordSource;
      if (reviewStatus) params.review_status = reviewStatus;
      if (assignedFilter) params.is_assigned = assignedFilter;
      if (ordering) params.ordering = ordering;

      const res = await api.get('/customers/', { params });
      if (res.data.results) {
        setCustomers(res.data.results);
        setTotalCount(res.data.count || res.data.results.length);
      } else {
        setCustomers(res.data || []);
        setTotalCount(res.data?.length || 0);
      }
    } catch (e) {
      console.error('Error fetching customers', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchCustomers(1);
  }, [recordSource, reviewStatus, assignedFilter, ordering]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchCustomers(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchCustomers(newPage);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-surface p-5 rounded-card-md shadow-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Customer Database</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Central repository of all imported and field-added DishHome customer records.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {isAgent && (
            <button
              onClick={() => navigate('/customers/new')}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-lg shadow transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          )}
          <button
            onClick={() => fetchCustomers(currentPage)}
            className="p-2 text-text-secondary hover:text-brand-red-dark bg-gray-50 rounded-lg border border-border"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-surface p-4 rounded-card-md shadow-card border border-border flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Customer ID, Customer Name, or Phone..."
            className="w-full pl-9 pr-20 py-2 bg-gray-50 border border-border rounded-lg text-xs focus:outline-none focus:border-brand-red"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1 bg-brand-red text-white text-xs font-semibold rounded-md uppercase"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Source Filter */}
          <select
            value={recordSource}
            onChange={(e) => setRecordSource(e.target.value)}
            className="px-2.5 py-2 bg-gray-50 border border-border rounded-lg text-xs focus:outline-none"
          >
            <option value="">All Sources</option>
            <option value="SUPERVISOR_UPLOAD">Excel Upload</option>
            <option value="AGENT_MANUAL">Agent Manual Entry</option>
          </select>

          {/* Allocation Filter */}
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="px-2.5 py-2 bg-gray-50 border border-border rounded-lg text-xs focus:outline-none"
          >
            <option value="">All Allocation</option>
            <option value="true">Assigned Only</option>
            <option value="false">Unassigned Only</option>
          </select>

          {/* Sort Filter */}
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value)}
            className="px-2.5 py-2 bg-gray-50 border border-border rounded-lg text-xs focus:outline-none"
          >
            <option value="-created_at">Newest First</option>
            <option value="-churn_days">Highest Churn Days</option>
            <option value="churn_days">Lowest Churn Days</option>
            <option value="customer_id">Customer ID (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-surface rounded-card-md shadow-card border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-text-secondary">Loading customer records...</div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-secondary">
            No customer records found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-text-secondary uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">Customer ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Churn Days</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Assigned Agent</th>
                  <th className="px-4 py-3">Review Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="hover:bg-brand-red-light/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-bold font-mono text-brand-red-dark">
                      {c.customer_id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      {c.customer_name || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      {c.phone_number ? (
                        <span className="text-text-primary font-mono">{c.phone_number}</span>
                      ) : (
                        <span className="text-text-secondary">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{c.churn_days}</td>
                    <td className="px-4 py-3">{c.package || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.record_source === 'AGENT_MANUAL'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {c.record_source === 'AGENT_MANUAL' ? 'Manual' : 'Excel'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.assigned_agent_name ? (
                        <span className="font-semibold text-text-primary">{c.assigned_agent_name}</span>
                      ) : (
                        <span className="text-text-secondary italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.review_status === 'APPROVED'
                          ? 'bg-emerald-100 text-success'
                          : c.review_status === 'PENDING_REVIEW'
                          ? 'bg-amber-100 text-warning'
                          : 'bg-red-100 text-danger'
                      }`}>
                        {c.review_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/visits/new?customer=${c.id}`)}
                          className="px-2.5 py-1 bg-brand-red text-white hover:bg-brand-red-dark text-[11px] font-bold rounded uppercase shadow-sm inline-flex items-center gap-1"
                        >
                          <ClipboardList className="w-3 h-3" />
                          <span>Visit</span>
                        </button>
                        <button
                          onClick={() => navigate(`/customers/${c.id}`)}
                          className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-gray-100"
                          title="View Details"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalCount > 0 && (
          <div className="p-4 border-t border-border bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-secondary">
            <div>
              Showing <span className="font-semibold text-text-primary">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-text-primary">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
              <span className="font-semibold text-text-primary">{totalCount}</span> customers
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                  className="px-3 py-1.5 bg-white border border-border rounded text-xs font-semibold text-text-primary hover:bg-gray-100 disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <span className="px-2 py-1 text-xs font-bold text-text-primary">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || loading}
                  className="px-3 py-1.5 bg-white border border-border rounded text-xs font-semibold text-text-primary hover:bg-gray-100 disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
