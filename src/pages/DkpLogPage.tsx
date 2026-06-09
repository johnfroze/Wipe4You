import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, getDkpLogs, clearDkpLogs } from '@/lib/supabase';
import type { DkpLog, CurrentUser } from '@/types';
import {
  Search, Filter, Download, Trash2,
  TrendingUp, TrendingDown, X, CheckCircle2,
  AlertTriangle, Loader2, ClipboardList,
} from 'lucide-react';

interface Props {
  currentUser: CurrentUser | null;
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-slide-in-right border
      ${type === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
      {type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      {message}
      <button onClick={onClose} className="ml-1 hover:text-white"><X size={13} /></button>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, loading = false }: {
  title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0d1117] border border-[#1e2d3d] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-fade-in">
        <h3 className="font-bold">{title}</h3>
        <p className="text-sm text-gray-400">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 rounded-xl text-sm bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 flex items-center gap-2 disabled:opacity-50 transition-colors">
            {loading && <Loader2 size={13} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DkpLogPage({ currentUser }: Props) {
  const isAdmin = currentUser?.member.role === 'leader' || currentUser?.member.role === 'elder';

  const [logs, setLogs] = useState<DkpLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'add' | 'remove'>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDkpLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load DKP log', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadLogs();
    const channel = supabase
      .channel('dkp-log-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dkp_log' }, loadLogs)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadLogs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const matchesType = typeFilter === 'all' || (typeFilter === 'add' ? l.amount > 0 : l.amount < 0);
      const q = search.toLowerCase();
      const matchesSearch = !search ||
        l.member_name.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q) ||
        l.admin_name.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [logs, typeFilter, search]);

  const stats = useMemo(() => ({
    totalAdded: logs.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0),
    totalRemoved: Math.abs(logs.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0)),
    entries: logs.length,
  }), [logs]);

  const exportCSV = () => {
    const headers = ['Date', 'Member', 'Amount', 'Reason', 'Admin', 'DKP Before', 'DKP After'];
    const rows = filtered.map((l) => [
      new Date(l.created_at).toLocaleString(),
      l.member_name, l.amount > 0 ? `+${l.amount}` : l.amount,
      l.reason, l.admin_name, l.dkp_before, l.dkp_after,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dkp-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('CSV exported', 'success');
  };

  const handleClearLogs = async () => {
    setClearLoading(true);
    try {
      await clearDkpLogs();
      await loadLogs();
      showToast('DKP log cleared', 'success');
    } catch {
      showToast('Failed to clear log', 'error');
    } finally {
      setClearLoading(false);
      setConfirmClear(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmClear && (
        <ConfirmModal
          title="Clear DKP Log"
          message="This permanently deletes all DKP history entries. This cannot be undone."
          confirmLabel="Clear All"
          onConfirm={handleClearLogs}
          onCancel={() => setConfirmClear(false)}
          loading={clearLoading}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2.5 tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center">
              <ClipboardList size={16} className="text-[#D4AF37]" />
            </div>
            DKP Log
          </h1>
          <p className="text-gray-500 text-sm mt-1">Full audit trail of every DKP change</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium border border-white/5 transition-all">
            <Download size={15} /> Export CSV
          </button>
          {isAdmin && (
            <button onClick={() => setConfirmClear(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium border border-red-500/20 transition-all">
              <Trash2 size={15} /> Clear Log
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-hud rounded-xl p-4 text-center corner-accent">
          <div className="text-2xl font-black hud-number text-[#D4AF37]">{stats.entries}</div>
          <div className="text-xs text-gray-600 mt-1 uppercase tracking-wider">Total Entries</div>
        </div>
        <div className="card-hud rounded-xl p-4 text-center corner-accent">
          <div className="text-2xl font-black hud-number text-green-400">+{stats.totalAdded.toLocaleString()}</div>
          <div className="text-xs text-gray-600 mt-1 uppercase tracking-wider">Total Added</div>
        </div>
        <div className="card-hud rounded-xl p-4 text-center corner-accent">
          <div className="text-2xl font-black hud-number text-red-400">-{stats.totalRemoved.toLocaleString()}</div>
          <div className="text-xs text-gray-600 mt-1 uppercase tracking-wider">Total Removed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member, reason, or admin..."
            className="w-full pl-9 pr-4 py-2.5 bg-black/60 border border-[#1e2d3d] rounded-xl text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="pl-9 pr-8 py-2.5 bg-black/60 border border-[#1e2d3d] rounded-xl text-sm appearance-none cursor-pointer focus:border-[rgba(212,175,55,0.5)] focus:outline-none">
            <option value="all">All Changes</option>
            <option value="add">Added Only</option>
            <option value="remove">Removed Only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading log...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList size={40} className="mx-auto text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm">No DKP log entries yet</p>
            <p className="text-gray-700 text-xs mt-1">
              Entries appear when admins add/remove DKP via the Admin panel
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e2d3d] text-left text-[11px] text-gray-600 uppercase tracking-wider">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Change</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Before → After</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id} className="border-b border-[#0f1923] table-row-hover">
                    <td className="px-4 py-3 font-medium text-sm">{log.member_name}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 font-black text-sm hud-number tabular-nums ${log.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {log.amount > 0
                          ? <TrendingUp size={13} />
                          : <TrendingDown size={13} />}
                        {log.amount > 0 ? `+${log.amount}` : log.amount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate">{log.reason}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{log.admin_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">
                      <span className="text-gray-600">{log.dkp_before.toLocaleString()}</span>
                      <span className="text-gray-700 mx-1">→</span>
                      <span className={log.amount > 0 ? 'text-green-400' : 'text-red-400'}>
                        {log.dkp_after.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {new Date(log.created_at).toLocaleDateString()}
                      <br />
                      <span className="text-gray-700">{new Date(log.created_at).toLocaleTimeString()}</span>
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
}
