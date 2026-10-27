import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  UserCheck,
  Users,
  Search,
  Filter,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Share2,
  ChevronRight,
  Loader2,
  Shuffle
} from 'lucide-react';

export const AllocationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(searchParams.get('batch') || '');
  const [batchData, setBatchData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED'>('ALL');

  // Row selection
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);

  // Bulk assign state
  const [bulkMode, setBulkMode] = useState<'SINGLE' | 'DISTRIBUTE'>('SINGLE');
  const [selectedSingleAgent, setSelectedSingleAgent] = useState<string>('');
  const [selectedDistributeAgents, setSelectedDistributeAgents] = useState<number[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 1-Click Entire Batch Allocation state
  const [batchAssignAgentId, setBatchAssignAgentId] = useState<string>('');
  const [batchAssigning, setBatchAssigning] = useState(false);

  // Reassignment modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [targetCustomer, setTargetCustomer] = useState<any>(null);
  const [reassignAgentId, setReassignAgentId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');

  const fetchBatches = async () => {
    try {
      const res = await api.get('/imports/');
      const confirmed = (res.data.results || res.data || []).filter((b: any) => b.import_status === 'CONFIRMED');
      setBatches(confirmed);
      if (!selectedBatchId && confirmed.length > 0) {
        setSelectedBatchId(String(confirmed[0].id));
      }
    } catch (e) {
      console.error('Error fetching batches', e);
    }
  };

  const fetchBatchAllocationData = async (batchId: string) => {
    if (!batchId) return;
    try {
      setLoading(true);
      setFeedback(null);
      setBatchData(null);
      const res = await api.get(`/allocations/batch/${batchId}/`);
      setBatchData(res.data);
      setSelectedCustomerIds([]);
    } catch (e: any) {
      console.error('Error fetching allocation data', e);
      setFeedback({
        type: 'error',
        message: e.response?.data?.detail || 'Could not load customers for this upload. Please refresh or contact an administrator.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchBatchAllocationData(selectedBatchId);
    }
  }, [selectedBatchId]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && batchData?.customers) {
      const filtered = getFilteredCustomers();
      setSelectedCustomerIds(filtered.map((c: any) => c.id));
    } else {
      setSelectedCustomerIds([]);
    }
  };

  const handleToggleRow = (id: number) => {
    setSelectedCustomerIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSingleAssign = async (customerId: number, agentId: string) => {
    if (!agentId) return;
    try {
      setFeedback(null);
      await api.post('/allocations/assign/', {
        customer_id: customerId,
        agent_id: parseInt(agentId),
        batch_id: parseInt(selectedBatchId),
      });
      fetchBatchAllocationData(selectedBatchId);
      setFeedback({ type: 'success', message: 'Customer successfully assigned.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Assignment failed.' });
    }
  };

  const handleExecuteBulkAssign = async () => {
    if (selectedCustomerIds.length === 0) {
      alert('Please select at least one customer row.');
      return;
    }

    try {
      setAssigning(true);
      setFeedback(null);

      if (bulkMode === 'SINGLE') {
        if (!selectedSingleAgent) {
          alert('Please select an agent for assignment.');
          return;
        }
        await api.post('/allocations/bulk/', {
          customer_ids: selectedCustomerIds,
          agent_id: parseInt(selectedSingleAgent),
          distribute_evenly: false,
          batch_id: parseInt(selectedBatchId),
        });
      } else {
        if (selectedDistributeAgents.length === 0) {
          alert('Please select at least two agents for even distribution.');
          return;
        }
        await api.post('/allocations/bulk/', {
          customer_ids: selectedCustomerIds,
          agent_ids: selectedDistributeAgents,
          distribute_evenly: true,
          batch_id: parseInt(selectedBatchId),
        });
      }

      setFeedback({
        type: 'success',
        message: `Successfully allocated ${selectedCustomerIds.length} customers!`,
      });
      fetchBatchAllocationData(selectedBatchId);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Bulk allocation failed.',
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleExecuteReassign = async () => {
    if (!targetCustomer || !reassignAgentId || !reassignReason.trim()) {
      alert('Please select the new agent and specify a reason.');
      return;
    }

    try {
      await api.post('/allocations/reassign/', {
        customer_id: targetCustomer.id,
        new_agent_id: parseInt(reassignAgentId),
        reason: reassignReason.trim(),
      });
      setReassignModalOpen(false);
      setTargetCustomer(null);
      setReassignReason('');
      fetchBatchAllocationData(selectedBatchId);
      setFeedback({ type: 'success', message: 'Customer successfully reassigned.' });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Reassignment failed.');
    }
  };

  const handleAssignEntireBatch = async () => {
    if (!batchAssignAgentId) {
      alert('Please select an agent to assign this entire batch.');
      return;
    }
    if (!selectedBatchId) return;

    try {
      setBatchAssigning(true);
      setFeedback(null);
      const res = await api.post('/allocations/assign-batch/', {
        batch_id: parseInt(selectedBatchId),
        agent_id: parseInt(batchAssignAgentId),
      });
      setFeedback({
        type: 'success',
        message: res.data.detail || `All customers in Batch #${selectedBatchId} allocated successfully!`,
      });
      setBatchAssignAgentId('');
      fetchBatchAllocationData(selectedBatchId);
      fetchBatches();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to allocate entire batch.',
      });
    } finally {
      setBatchAssigning(false);
    }
  };

  const getFilteredCustomers = () => {
    if (!batchData?.customers) return [];
    return batchData.customers.filter((c: any) => {
      const matchSearch =
        (c.customer_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone_number || '').includes(searchTerm);

      if (!matchSearch) return false;

      if (filterStatus === 'UNASSIGNED') return !c.is_allocated;
      if (filterStatus === 'ASSIGNED') return c.is_allocated;
      return true;
    });
  };

  const filteredCustomers = getFilteredCustomers();
  const agents = batchData?.eligible_agents || [];

  return (
    <div className="space-y-6">
      {/* Top Batch Selection Bar */}
      <div className="bg-surface p-5 rounded-card-md shadow-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Allocate Customers to D2D Team</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Assign individual customers or distribute bulk batches evenly among your supervised field agents.
          </p>
        </div>

        {/* Batch Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs font-semibold text-text-secondary shrink-0">Select Batch:</label>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="w-full md:w-64 px-3 py-2 bg-gray-50 border border-border rounded-lg text-xs font-medium focus:outline-none focus:border-brand-red"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                Batch #{b.id} - {b.filename} ({b.allocation_status})
              </option>
            ))}
          </select>
          <button
            onClick={() => fetchBatchAllocationData(selectedBatchId)}
            className="p-2 text-text-secondary hover:text-brand-red-dark bg-gray-50 rounded-lg border border-border"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-lg flex items-center gap-2.5 text-xs font-semibold ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-success border border-emerald-200'
            : 'bg-red-50 text-danger border border-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Batch Overview Counters */}
      {batchData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface p-4 rounded-card-md shadow-card border border-border">
            <span className="text-xs font-medium text-text-secondary">Batch Customers</span>
            <p className="text-2xl font-bold text-text-primary mt-1">{batchData.total_customers}</p>
          </div>
          <div className="bg-surface p-4 rounded-card-md shadow-card border border-border">
            <span className="text-xs font-medium text-text-secondary">Allocated</span>
            <p className="text-2xl font-bold text-success mt-1">{batchData.allocated_count}</p>
          </div>
          <div className="bg-surface p-4 rounded-card-md shadow-card border border-border">
            <span className="text-xs font-medium text-text-secondary">Remaining Unallocated</span>
            <p className="text-2xl font-bold text-warning mt-1">{batchData.unallocated_count}</p>
          </div>
          <div className="bg-surface p-4 rounded-card-md shadow-card border border-border">
            <span className="text-xs font-medium text-text-secondary">Eligible Agents</span>
            <p className="text-2xl font-bold text-blue-600 mt-1">{agents.length}</p>
          </div>
        </div>
      )}

      {/* 1-Click Entire Batch Quick Allocation Card */}
      {batchData && batchData.unallocated_count > 0 && (
        <div className="bg-gradient-to-r from-red-50 via-white to-red-50 border-2 border-brand-red/30 rounded-card-md p-5 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-brand-red text-white text-[10px] font-bold uppercase rounded">
                  Area Batch Quick Allocate
                </span>
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                  Assign Entire Uploaded File to One Agent
                </h3>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Have 40+ customer records for one area? Assign all <strong>{batchData.unallocated_count} unassigned</strong> customers in this file directly to an area agent in one click without doing it one-by-one.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              <select
                value={batchAssignAgentId}
                onChange={(e) => setBatchAssignAgentId(e.target.value)}
                className="w-full md:w-56 px-3 py-2 bg-white border border-brand-red/40 rounded-lg text-xs font-medium focus:outline-none focus:border-brand-red"
              >
                <option value="">-- Choose Field Agent --</option>
                {agents.map((ag: any) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.full_name} ({ag.assigned_count} currently assigned)
                  </option>
                ))}
              </select>

              <button
                onClick={handleAssignEntireBatch}
                disabled={batchAssigning || !batchAssignAgentId}
                className="px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-lg shadow transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {batchAssigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Assign All ({batchData.unallocated_count})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Controls */}
      <div className="bg-surface p-5 rounded-card-md shadow-card border border-border">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase text-text-primary tracking-wide">
              Selected Customers: <span className="text-brand-red">{selectedCustomerIds.length}</span>
            </span>

            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setBulkMode('SINGLE')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  bulkMode === 'SINGLE' ? 'bg-surface text-brand-red font-bold shadow-sm' : 'text-text-secondary'
                }`}
              >
                Assign to One Agent
              </button>
              <button
                type="button"
                onClick={() => setBulkMode('DISTRIBUTE')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  bulkMode === 'DISTRIBUTE' ? 'bg-surface text-brand-red font-bold shadow-sm' : 'text-text-secondary'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Distribute Evenly</span>
              </button>
            </div>
          </div>

          {/* Bulk Assign Execution Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {bulkMode === 'SINGLE' ? (
              <select
                value={selectedSingleAgent}
                onChange={(e) => setSelectedSingleAgent(e.target.value)}
                className="px-3 py-2 bg-input-bg border-b-2 border-input-focus rounded-t-md text-xs font-medium focus:outline-none"
              >
                <option value="">-- Choose Agent --</option>
                {agents.map((ag: any) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.full_name} ({ag.assigned_count} currently assigned)
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto max-w-md py-1">
                <span className="text-[11px] text-text-secondary shrink-0">Distribute to:</span>
                {agents.map((ag: any) => {
                  const isChecked = selectedDistributeAgents.includes(ag.id);
                  return (
                    <label
                      key={ag.id}
                      className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer select-none transition-colors shrink-0 ${
                        isChecked
                          ? 'bg-brand-red-light border-brand-red text-brand-red-dark font-bold'
                          : 'bg-gray-50 border-border text-text-secondary'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDistributeAgents([...selectedDistributeAgents, ag.id]);
                          } else {
                            setSelectedDistributeAgents(selectedDistributeAgents.filter(x => x !== ag.id));
                          }
                        }}
                        className="hidden"
                      />
                      <span>{ag.full_name?.split(' ')[0]}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <button
              onClick={handleExecuteBulkAssign}
              disabled={assigning || selectedCustomerIds.length === 0}
              className="px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-md shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {assigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Allocation</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, Name, Phone..."
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-border rounded-lg text-xs focus:outline-none focus:border-brand-red"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-text-secondary">Filter:</span>
            <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-medium">
              {(['ALL', 'UNASSIGNED', 'ASSIGNED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 rounded-md capitalize transition-colors ${
                    filterStatus === st ? 'bg-surface text-brand-red font-bold shadow-sm' : 'text-text-secondary'
                  }`}
                >
                  {st.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Selection Helpers */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary font-medium">Quick Select:</span>
            <button
              type="button"
              onClick={() => {
                const unassignedIds = filteredCustomers.filter((c: any) => !c.is_allocated).map((c: any) => c.id);
                setSelectedCustomerIds(unassignedIds);
              }}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-text-primary rounded text-[11px] font-semibold transition-colors"
            >
              All Unassigned ({filteredCustomers.filter((c: any) => !c.is_allocated).length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCustomerIds(filteredCustomers.map((c: any) => c.id))}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-text-primary rounded text-[11px] font-semibold transition-colors"
            >
              All Filtered ({filteredCustomers.length})
            </button>
            {selectedCustomerIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCustomerIds([])}
                className="px-2.5 py-1 text-danger hover:bg-red-50 rounded text-[11px] font-semibold transition-colors"
              >
                Clear Selection ({selectedCustomerIds.length})
              </button>
            )}
          </div>
          <span className="text-text-secondary text-[11px]">
            Tip: You can allocate selected customers or use the 1-click Area Batch card above.
          </span>
        </div>
      </div>

      {/* Allocation Table */}
      <div className="bg-surface rounded-card-md shadow-card border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-text-secondary">Loading batch customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-secondary">No matching customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-text-secondary uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedCustomerIds.length === filteredCustomers.length &&
                        filteredCustomers.length > 0
                      }
                      onChange={handleSelectAll}
                      className="rounded border-border text-brand-red focus:ring-brand-red accent-brand-red cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">Customer ID</th>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Churn Days</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Allocation Status</th>
                  <th className="px-4 py-3">Assigned Agent</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.map((cust: any) => {
                  const isChecked = selectedCustomerIds.includes(cust.id);
                  return (
                    <tr
                      key={cust.id}
                      className={`hover:bg-brand-red-light/20 ${isChecked ? 'bg-brand-red-light/30' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRow(cust.id)}
                          className="rounded border-border text-brand-red focus:ring-brand-red accent-brand-red cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold font-mono text-brand-red-dark">
                        {cust.customer_id}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {cust.customer_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3">{cust.phone_number || 'N/A'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{cust.churn_days}</td>
                      <td className="px-4 py-3">{cust.package}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cust.is_allocated ? 'bg-emerald-100 text-success' : 'bg-amber-100 text-warning'
                        }`}>
                          {cust.is_allocated ? 'Allocated' : 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {cust.is_allocated ? (
                          <span className="font-semibold text-text-primary">
                            {cust.assigned_agent_name}
                          </span>
                        ) : (
                          <select
                            defaultValue=""
                            onChange={(e) => handleSingleAssign(cust.id, e.target.value)}
                            className="px-2 py-1 bg-gray-50 border border-border rounded text-xs focus:outline-none focus:border-brand-red"
                          >
                            <option value="" disabled>Select Agent</option>
                            {agents.map((ag: any) => (
                              <option key={ag.id} value={ag.id}>
                                {ag.full_name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {cust.is_allocated && (
                          <button
                            onClick={() => {
                              setTargetCustomer(cust);
                              setReassignAgentId('');
                              setReassignReason('');
                              setReassignModalOpen(true);
                            }}
                            className="px-2 py-1 bg-gray-100 hover:bg-brand-red-light text-text-secondary hover:text-brand-red-dark text-[11px] font-semibold rounded transition-colors"
                          >
                            Reassign
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reassignment Modal */}
      {reassignModalOpen && targetCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-surface rounded-card-md p-6 max-w-md w-full shadow-2xl border border-border">
            <h3 className="text-base font-bold text-text-primary uppercase mb-1">
              Reassign Customer: {targetCustomer.customer_id}
            </h3>
            <p className="text-xs text-text-secondary mb-4">
              Current Agent: <strong>{targetCustomer.assigned_agent_name}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">New Agent</label>
                <select
                  value={reassignAgentId}
                  onChange={(e) => setReassignAgentId(e.target.value)}
                  className="w-full px-3 py-2 bg-input-bg border-b-2 border-input-focus rounded-t-md text-xs font-medium focus:outline-none"
                >
                  <option value="">-- Select New Agent --</option>
                  {agents.filter((a: any) => a.id !== targetCustomer.assigned_agent_id).map((ag: any) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Reason for Reassignment *
                </label>
                <textarea
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Area reallocation, Agent on leave, Route optimization..."
                  rows={3}
                  className="w-full px-3 py-2 bg-input-bg border-b-2 border-input-focus rounded-t-md text-xs text-text-primary focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setReassignModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReassign}
                className="px-5 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-md shadow"
              >
                Save Reassignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
