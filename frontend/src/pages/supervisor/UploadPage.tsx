import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Clock,
  UserCheck,
  Loader2,
  Trash2
} from 'lucide-react';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedBatch, setConfirmedBatch] = useState<any>(null);
  const [pastBatches, setPastBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Agent team state for 1-click batch allocation
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [quickAssignMap, setQuickAssignMap] = useState<{ [batchId: number]: string }>({});
  const [quickAssigningId, setQuickAssigningId] = useState<number | null>(null);
  const [quickAssignMessage, setQuickAssignMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // File deletion state (Supervisor wrong-file recovery)
  const [batchToDelete, setBatchToDelete] = useState<any | null>(null);
  const [deletingBatchId, setDeletingBatchId] = useState<number | null>(null);

  const handleDeleteBatch = async (batchId: number) => {
    try {
      setDeletingBatchId(batchId);
      const res = await api.delete(`/imports/${batchId}/`);
      setQuickAssignMessage({
        type: 'success',
        text: `${res.data.detail} Removed ${res.data.deleted_customers} new customers; preserved ${res.data.preserved_customers} existing or active customers.`,
      });
      if (confirmedBatch?.batch_id === batchId) {
        setConfirmedBatch(null);
        setPreviewData(null);
        setFile(null);
      }
      setBatchToDelete(null);
      fetchPastBatches();
    } catch (err: any) {
      setQuickAssignMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to delete upload file.',
      });
    } finally {
      setDeletingBatchId(null);
    }
  };

  const fetchPastBatches = async () => {
    try {
      setLoadingBatches(true);
      const res = await api.get('/imports/');
      setPastBatches(res.data.results || res.data || []);
    } catch (e) {
      console.error('Error fetching past batches', e);
    } finally {
      setLoadingBatches(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await api.get('/users/eligible-agents/');
      setAgents(res.data || []);
    } catch (e) {
      console.error('Error fetching eligible agents', e);
    }
  };

  useEffect(() => {
    fetchPastBatches();
    fetchAgents();
  }, []);

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/imports/template/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'DishHome_D2D_Upload_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to download template. Please try again.');
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls') && !selectedFile.name.endsWith('.csv')) {
      setErrorMessage('Please select a valid Excel (.xlsx) file.');
      return;
    }
    setFile(selectedFile);
    setErrorMessage(null);
    setPreviewData(null);
    setConfirmedBatch(null);
    setSelectedAgentId('');
  };

  const handleUploadAndPreview = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setErrorMessage(null);
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/imports/preview/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPreviewData(res.data);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to parse upload file. Please verify column headers.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData?.batch_id) return;

    try {
      setConfirming(true);
      setErrorMessage(null);
      const payload: any = {};
      if (selectedAgentId) {
        payload.agent_id = parseInt(selectedAgentId);
      }

      const res = await api.post(`/imports/${previewData.batch_id}/confirm/`, payload);
      setConfirmedBatch(res.data);
      fetchPastBatches();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to confirm import batch.');
    } finally {
      setConfirming(false);
    }
  };

  const handleQuickAllocateBatch = async (batchId: number, agentIdStr: string) => {
    if (!agentIdStr) {
      alert('Please select an agent to allocate this batch.');
      return;
    }

    try {
      setQuickAssigningId(batchId);
      setQuickAssignMessage(null);
      const res = await api.post('/allocations/assign-batch/', {
        batch_id: batchId,
        agent_id: parseInt(agentIdStr),
      });

      setQuickAssignMessage({
        type: 'success',
        text: res.data.detail || `Batch #${batchId} allocated successfully!`,
      });
      fetchPastBatches();
    } catch (err: any) {
      setQuickAssignMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to allocate batch.',
      });
    } finally {
      setQuickAssigningId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Template Download */}
      <div className="bg-surface p-6 rounded-card-md shadow-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Upload Customer Churn Data</h2>
          <p className="text-xs text-text-secondary mt-1">
            Upload the standardized 5-column Excel sheet: Customer ID, Customer Name, Phone Number, No. of Churn Days, Package.
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-brand-red-light text-brand-red-dark border border-brand-red/30 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Download Excel Template</span>
        </button>
      </div>

      {/* Drag & Drop Upload Card */}
      <div className="bg-surface p-6 rounded-card-md shadow-card border border-border">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            isDragging
              ? 'border-brand-red bg-brand-red-light/40'
              : file
              ? 'border-success/60 bg-emerald-50/30'
              : 'border-border bg-gray-50/50 hover:border-brand-red/50'
          }`}
        >
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-brand-red-light text-brand-red flex items-center justify-center">
            <FileSpreadsheet className="w-7 h-7" />
          </div>

          {file ? (
            <div className="space-y-2">
              <p className="text-sm font-bold text-text-primary">{file.name}</p>
              <p className="text-xs text-text-secondary">{(file.size / 1024).toFixed(1)} KB</p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleUploadAndPreview}
                  disabled={uploading}
                  className="px-5 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-md shadow transition-all flex items-center gap-1.5"
                >
                  {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{uploading ? 'Processing Sheet...' : 'Parse & Preview Data'}</span>
                </button>
                <button
                  onClick={() => { setFile(null); setPreviewData(null); setConfirmedBatch(null); }}
                  className="px-3 py-2 text-text-secondary hover:text-danger text-xs font-medium"
                >
                  Change File
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Drag and drop your Excel file here, or{' '}
                <label className="text-brand-red hover:underline cursor-pointer">
                  browse file
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
                  />
                </label>
              </p>
              <p className="text-xs text-text-secondary mt-1">Supports .xlsx and .csv files up to 20MB</p>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-danger text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Confirmation Success Banner with Allocate Team Button */}
      {confirmedBatch && (
        <div className="bg-emerald-50 border-2 border-success rounded-card-md p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-success text-white flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-success">Import Confirmed Successfully!</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Batch #{confirmedBatch.batch_id} created: {confirmedBatch.created_customers} new customers, {confirmedBatch.existing_linked} existing linked.
                {confirmedBatch.agent_name
                  ? ` All customers allocated directly to ${confirmedBatch.agent_name}.`
                  : confirmedBatch.allocated_to_name
                  ? ` Assigned to ${confirmedBatch.allocated_to_name}.`
                  : ' Batch ready for team allocation.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!confirmedBatch.agent_name && (
              <div className="flex items-center gap-2">
                <select
                  value={quickAssignMap[confirmedBatch.batch_id] || ''}
                  onChange={(e) => setQuickAssignMap({ ...quickAssignMap, [confirmedBatch.batch_id]: e.target.value })}
                  className="px-3 py-2 bg-white border border-border rounded-lg text-xs font-medium focus:outline-none focus:border-brand-red"
                >
                  <option value="">Quick Assign to Agent...</option>
                  {agents.map((ag: any) => (
                    <option key={ag.id} value={ag.id}>{ag.full_name || ag.username}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleQuickAllocateBatch(confirmedBatch.batch_id, quickAssignMap[confirmedBatch.batch_id])}
                  disabled={quickAssigningId === confirmedBatch.batch_id || !quickAssignMap[confirmedBatch.batch_id]}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase rounded-lg shadow transition-all disabled:opacity-50"
                >
                  {quickAssigningId === confirmedBatch.batch_id ? 'Assigning...' : 'Assign Batch'}
                </button>
              </div>
            )}
            <button
              onClick={() => navigate(`/supervisor/allocation?batch=${confirmedBatch.batch_id}`)}
              className="px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-lg shadow-md transition-all flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              <span>Manage Allocations</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Import Preview Section */}
      {previewData && !confirmedBatch && (
        <div className="bg-surface rounded-card-md shadow-card border border-border overflow-hidden">
          {/* Summary Metric Header */}
          <div className="p-5 border-b border-border bg-gray-50/60 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                Import Preview Summary
              </h3>
              <p className="text-xs text-text-secondary">File: {previewData.filename}</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-semibold">
                Total: {previewData.total_rows}
              </span>
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-50 text-success font-semibold">
                Valid: {previewData.valid_rows}
              </span>
              {previewData.duplicate_rows > 0 && (
                <span className="text-xs px-2.5 py-1 rounded bg-amber-50 text-warning font-semibold">
                  Duplicates: {previewData.duplicate_rows}
                </span>
              )}
              {previewData.invalid_rows > 0 && (
                <span className="text-xs px-2.5 py-1 rounded bg-red-50 text-danger font-semibold">
                  Errors: {previewData.invalid_rows}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label htmlFor="import-agent" className="text-xs font-semibold text-text-secondary shrink-0">
                Assign to agent:
              </label>
              <select
                id="import-agent"
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                disabled={agents.length === 0}
                className="px-3 py-2 bg-input-bg border border-border rounded-md text-xs font-medium focus:outline-none focus:border-brand-red disabled:opacity-60"
              >
                <option value="">
                  {agents.length === 0 ? 'No eligible agents' : 'Import without assigning'}
                </option>
                {agents.map((agent: any) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name || agent.username}
                  </option>
                ))}
              </select>
              <button
                onClick={handleConfirmImport}
                disabled={confirming || previewData.valid_rows === 0}
                className="px-5 py-2 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-md shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {confirming && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{selectedAgentId ? 'Confirm, Import & Allocate' : 'Confirm & Import'} ({previewData.valid_rows})</span>
              </button>
            </div>
          </div>

          {/* Validation Errors If Any */}
          {previewData.errors && previewData.errors.length > 0 && (
            <div className="p-4 bg-red-50/60 border-b border-red-200">
              <p className="text-xs font-bold text-danger uppercase mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Rows with Validation Errors (Will be skipped)</span>
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {previewData.errors.map((errRow: any, idx: number) => (
                  <div key={idx} className="text-xs text-danger/90 bg-white p-2 rounded border border-red-100 flex items-center justify-between">
                    <span>
                      <strong>Row {errRow.row_number}:</strong> Customer ID: "{errRow.customer_id || 'Empty'}" - {errRow.errors.join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-text-secondary uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">Row #</th>
                  <th className="px-4 py-3">Customer ID</th>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3 text-right">No. of Churn Days</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {previewData.preview_rows.map((row: any, idx: number) => (
                  <tr key={idx} className={`hover:bg-brand-red-light/30 ${!row.is_valid ? 'bg-red-50/40 text-danger' : row.is_duplicate ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-4 py-2.5 font-medium">{row.row_number}</td>
                    <td className="px-4 py-2.5 font-bold font-mono">{row.customer_id}</td>
                    <td className="px-4 py-2.5">{row.customer_name}</td>
                    <td className="px-4 py-2.5">{row.phone_number}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{row.churn_days}</td>
                    <td className="px-4 py-2.5">{row.package}</td>
                    <td className="px-4 py-2.5">
                      {!row.is_valid ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-danger">
                          Invalid
                        </span>
                      ) : row.is_duplicate ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-warning">
                          Existing / Dup
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-success">
                          Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Past Import Batches History */}
      <div className="bg-surface rounded-card-md shadow-card border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
            Past Import Batches
          </h3>
          <span className="text-xs text-text-secondary">{pastBatches.length} Batches</span>
        </div>

        {quickAssignMessage && (
          <div className={`p-3 m-4 rounded-lg flex items-center gap-2 text-xs font-semibold ${
            quickAssignMessage.type === 'success'
              ? 'bg-emerald-50 text-success border border-emerald-200'
              : 'bg-red-50 text-danger border border-red-200'
          }`}>
            {quickAssignMessage.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{quickAssignMessage.text}</span>
          </div>
        )}

        {loadingBatches ? (
          <div className="p-8 text-center text-xs text-text-secondary">Loading batches...</div>
        ) : pastBatches.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-secondary">No upload batches yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-text-secondary uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">Batch ID</th>
                  <th className="px-4 py-3">Filename</th>
                  <th className="px-4 py-3">Uploaded By</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-center">Valid</th>
                  <th className="px-4 py-3">Import Status</th>
                  <th className="px-4 py-3">Allocation Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pastBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-brand-red-light/20">
                    <td className="px-4 py-3 font-bold font-mono">#{batch.id}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{batch.filename}</td>
                    <td className="px-4 py-3">{batch.uploaded_by_name}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(batch.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{batch.total_rows}</td>
                    <td className="px-4 py-3 text-center text-success font-medium">{batch.valid_rows}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        batch.import_status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-success'
                          : 'bg-amber-100 text-warning'
                      }`}>
                        {batch.import_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        batch.allocation_status === 'FULLY_ALLOCATED'
                          ? 'bg-emerald-100 text-success'
                          : batch.allocation_status === 'PARTIALLY_ALLOCATED'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-text-secondary'
                      }`}>
                        {batch.allocation_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {batch.import_status === 'CONFIRMED' && (
                          <>
                          {batch.allocation_status !== 'FULLY_ALLOCATED' && (
                            <>
                              <select
                                value={quickAssignMap[batch.id] || ''}
                                onChange={(e) =>
                                  setQuickAssignMap({ ...quickAssignMap, [batch.id]: e.target.value })
                                }
                                className="px-2 py-1 bg-white border border-border rounded text-[11px] focus:outline-none focus:border-brand-red"
                              >
                                <option value="">Assign File to Agent...</option>
                                {agents.map((ag: any) => (
                                  <option key={ag.id} value={ag.id}>
                                    {ag.full_name || ag.username}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleQuickAllocateBatch(batch.id, quickAssignMap[batch.id])}
                                disabled={quickAssigningId === batch.id || !quickAssignMap[batch.id]}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded shadow-sm disabled:opacity-40 uppercase"
                                title="Allocate entire uploaded file to selected agent"
                              >
                                {quickAssigningId === batch.id ? '...' : 'Assign'}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => navigate(`/supervisor/allocation?batch=${batch.id}`)}
                            className="px-2.5 py-1 bg-brand-red text-white hover:bg-brand-red-dark text-[11px] font-bold rounded shadow-sm transition-colors uppercase inline-flex items-center gap-1"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>{batch.allocation_status === 'FULLY_ALLOCATED' ? 'View' : 'Allocate'}</span>
                          </button>
                          </>
                        )}
                        <button
                          onClick={() => setBatchToDelete(batch)}
                          disabled={deletingBatchId === batch.id}
                          className="p-1 text-text-secondary hover:text-danger hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Delete this uploaded file"
                        >
                          {deletingBatchId === batch.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Batch Confirmation Modal */}
      {batchToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-surface rounded-card-md p-6 max-w-md w-full shadow-2xl border border-border">
            <div className="flex items-center gap-3 text-danger mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-danger" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary uppercase">
                  Delete Uploaded File?
                </h3>
                <p className="text-xs text-text-secondary">
                  Batch #{batchToDelete.id} — {batchToDelete.filename}
                </p>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed bg-gray-50 p-3 rounded-lg border border-border mb-4">
              Deleting this batch removes the upload and its links. Customers created only by this upload are deleted only if they have no assignments, visits, or follow-ups. Existing or active customer records are preserved.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBatchToDelete(null)}
                disabled={deletingBatchId !== null}
                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteBatch(batchToDelete.id)}
                disabled={deletingBatchId !== null}
                className="px-4 py-2 bg-danger hover:bg-red-700 text-white text-xs font-bold uppercase rounded-md shadow transition-colors flex items-center gap-1.5"
              >
                {deletingBatchId === batchToDelete.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deletingBatchId === batchToDelete.id ? 'Deleting File...' : 'Yes, Delete File'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
