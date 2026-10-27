import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  UserPlus,
  Users,
  Phone,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  UserCheck,
  UserX,
  Trash2,
  AlertTriangle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export const TeamManagementPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [agents, setAgents] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [managedRole, setManagedRole] = useState<'AGENT' | 'SUPERVISOR'>('AGENT');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Deactivate & Delete Action States
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users/');
      setAgents(res.data.results || res.data || []);
      if (isAdmin) {
        const supervisorRes = await api.get('/users/?role=SUPERVISOR');
        setSupervisors(supervisorRes.data.results || supervisorRes.data || []);
      }
    } catch (e) {
      console.error('Error fetching team agents', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [isAdmin]);

  const handleToggleActive = async (agent: any) => {
    try {
      setTogglingId(agent.id);
      setError(null);
      setSuccess(null);
      const res = await api.post(`/users/${agent.id}/toggle-active/`);
      setSuccess(res.data.detail || `Agent account status updated.`);
      fetchAgents();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update agent status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteAgent = async (force: boolean = false) => {
    if (!agentToDelete) return;
    try {
      setDeletingId(agentToDelete.id);
      setError(null);
      const url = force ? `/users/${agentToDelete.id}/?force=true` : `/users/${agentToDelete.id}/`;
      const res = await api.delete(url);
      setSuccess(res.data?.detail || `Agent ${agentToDelete.username} deleted successfully.`);
      setAgentToDelete(null);
      setDeleteWarning(null);
      fetchAgents();
    } catch (err: any) {
      if (err.response?.data?.has_visits) {
        setDeleteWarning(err.response.data.detail);
      } else {
        setError(err.response?.data?.detail || 'Failed to delete agent.');
        setAgentToDelete(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password || password.length < 6) {
      setError('Username and password (min 6 characters) are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.post('/users/', {
        username: username.trim(),
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        password: password,
        role: managedRole,
        ...(isAdmin && managedRole === 'AGENT' && selectedSupervisorId
          ? { supervisor: parseInt(selectedSupervisorId) }
          : {}),
      });

      setSuccess(`${managedRole === 'SUPERVISOR' ? 'Supervisor' : 'Agent'} ${username} created successfully.`);
      setUsername('');
      setFullName('');
      setPhoneNumber('');
      setPassword('');
      setManagedRole('AGENT');
      setSelectedSupervisorId('');
      setShowCreateModal(false);
      fetchAgents();
    } catch (err: any) {
      const msg = err.response?.data?.username?.[0] ||
                  err.response?.data?.role?.[0] ||
                  err.response?.data?.supervisor?.[0] ||
                  err.response?.data?.detail ||
                  'Failed to create agent.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-surface p-6 rounded-card-md shadow-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">
            {isAdmin ? 'User & Role Management' : 'D2D Field Agent Management'}
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            {isAdmin
              ? 'Manage supervisors and field agents across all teams.'
              : 'Create, deactivate, and delete field agents assigned to your operations team.'}
          </p>
        </div>

        <button
          onClick={() => { setError(null); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-lg shadow transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>{isAdmin ? 'Add User' : 'Add New Agent'}</span>
        </button>
      </div>

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-success text-xs font-semibold rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Agents List Card */}
      <div className="bg-surface rounded-card-md shadow-card border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-gray-50/50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            {isAdmin ? `Managed Users (${agents.length})` : `Supervised D2D Agents (${agents.length})`}
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-text-secondary">Loading team agents...</div>
        ) : agents.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-secondary">
            {isAdmin
              ? 'No supervisors or agents found. Click "Add User" to create an account.'
              : 'No agents found under your supervision. Click "Add New Agent" to create one.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-text-secondary uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">Agent Name</th>
                  {isAdmin && <th className="px-4 py-3">Role</th>}
                  <th className="px-4 py-3">Username</th>
                  {isAdmin && <th className="px-4 py-3">Supervisor</th>}
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-center">Active Workload</th>
                  <th className="px-4 py-3 text-center">Completed Visits</th>
                  <th className="px-4 py-3">Account Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {agents.map((ag) => (
                  <tr key={ag.id} className="hover:bg-brand-red-light/20">
                    <td className="px-4 py-3 font-bold text-text-primary">
                      {ag.full_name || ag.username}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-text-secondary text-[10px] font-bold">
                          {ag.role}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-text-secondary">
                      {ag.username}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-text-secondary">
                        {ag.supervisor_name || '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono">
                      {ag.phone_number || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-text-primary">
                      {ag.assigned_customers_count || 0} customers
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-success">
                      {ag.completed_visits_count || 0}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ag.is_active ? 'bg-emerald-100 text-success' : 'bg-red-100 text-danger'
                      }`}>
                        {ag.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleActive(ag)}
                          disabled={togglingId === ag.id}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded uppercase transition-colors flex items-center gap-1 ${
                            ag.is_active
                              ? 'bg-amber-50 text-warning hover:bg-amber-100 border border-warning/30'
                              : 'bg-emerald-50 text-success hover:bg-emerald-100 border border-success/30'
                          }`}
                          title={ag.is_active ? 'Deactivate this agent' : 'Activate this agent'}
                        >
                          {togglingId === ag.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : ag.is_active ? (
                            <UserX className="w-3 h-3" />
                          ) : (
                            <UserCheck className="w-3 h-3" />
                          )}
                          <span>{ag.is_active ? 'Deactivate' : 'Activate'}</span>
                        </button>

                        <button
                          onClick={() => {
                            setDeleteWarning(null);
                            setAgentToDelete(ag);
                          }}
                          className="p-1.5 text-text-secondary hover:text-danger hover:bg-red-50 rounded transition-colors"
                          title="Delete agent account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Delete Agent Modal */}
      {agentToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-surface rounded-card-md p-6 max-w-md w-full shadow-2xl border border-border">
            <div className="flex items-center gap-3 text-danger mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-danger" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary uppercase">
                  Delete User Account?
                </h3>
                <p className="text-xs text-text-secondary">
                  {agentToDelete.full_name || agentToDelete.username} (@{agentToDelete.username})
                </p>
              </div>
            </div>

            {deleteWarning ? (
              <div className="space-y-3 mb-4">
                <div className="p-3 bg-amber-50 border border-warning/40 rounded-lg text-xs text-warning font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{deleteWarning}</span>
                </div>
                <p className="text-xs text-text-secondary">
                  Do you still wish to permanently delete this agent account and their records?
                </p>
              </div>
            ) : (
              <p className="text-xs text-text-secondary leading-relaxed bg-gray-50 p-3 rounded-lg border border-border mb-4">
                Deleting this account will remove it permanently. Any currently active customer assignments will be automatically unassigned so other agents can be allocated.
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setAgentToDelete(null);
                  setDeleteWarning(null);
                }}
                disabled={deletingId !== null}
                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>

              {deleteWarning ? (
                <button
                  type="button"
                  onClick={() => handleDeleteAgent(true)}
                  disabled={deletingId !== null}
                  className="px-4 py-2 bg-danger hover:bg-red-700 text-white text-xs font-bold uppercase rounded-md shadow transition-colors flex items-center gap-1.5"
                >
                  {deletingId !== null && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Permanent Delete</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDeleteAgent(false)}
                  disabled={deletingId !== null}
                  className="px-4 py-2 bg-danger hover:bg-red-700 text-white text-xs font-bold uppercase rounded-md shadow transition-colors flex items-center gap-1.5"
                >
                  {deletingId !== null && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Delete Account</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-surface rounded-card-md p-6 max-w-md w-full shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h3 className="text-sm font-bold text-text-primary uppercase flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-brand-red" />
                <span>Create {managedRole === 'SUPERVISOR' ? 'Supervisor' : 'D2D Agent'}</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                &times;
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-danger text-xs rounded-lg flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateAgent} className="space-y-4 text-xs">
              {isAdmin && (
                <div>
                  <label className="block font-bold text-text-secondary uppercase mb-1">
                    Account Role *
                  </label>
                  <select
                    value={managedRole}
                    onChange={(e) => {
                      setManagedRole(e.target.value as 'AGENT' | 'SUPERVISOR');
                      setSelectedSupervisorId('');
                    }}
                    className="w-full px-3 py-2.5 bg-input-bg border-b-2 border-input-focus rounded-t-md text-text-primary focus:outline-none"
                  >
                    <option value="AGENT">Field Agent</option>
                    <option value="SUPERVISOR">Supervisor</option>
                  </select>
                </div>
              )}
              {isAdmin && managedRole === 'AGENT' && (
                <div>
                  <label className="block font-bold text-text-secondary uppercase mb-1">
                    Assign Supervisor
                  </label>
                  <select
                    value={selectedSupervisorId}
                    onChange={(e) => setSelectedSupervisorId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-input-bg border-b-2 border-input-focus rounded-t-md text-text-primary focus:outline-none"
                  >
                    <option value="">No supervisor</option>
                    {supervisors.map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.full_name || supervisor.username}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block font-bold text-text-secondary uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Shrestha"
                  className="w-full px-3 py-2.5 bg-input-bg border-b-2 border-input-focus rounded-t-md text-text-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-text-secondary uppercase mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                  placeholder="e.g. ramesh.d2d"
                  className="w-full px-3 py-2.5 bg-input-bg border-b-2 border-input-focus rounded-t-md font-mono text-text-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-text-secondary uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 98XXXXXXXX"
                  className="w-full px-3 py-2.5 bg-input-bg border-b-2 border-input-focus rounded-t-md text-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-text-secondary uppercase mb-1">
                  Password (min 6 characters) *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create initial account password"
                  className="w-full px-3 py-2.5 bg-input-bg border-b-2 border-input-focus rounded-t-md text-text-primary focus:outline-none"
                  required
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-border mt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-text-secondary hover:bg-gray-100 rounded-md font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white font-bold uppercase rounded-md shadow flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
