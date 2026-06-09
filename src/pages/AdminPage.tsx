import { useState, useCallback, useEffect } from 'react';
import { updateMemberDkp, updateMemberRole, updateMemberUsername, deleteMember, createDkpLog, getDefaultRaffleTicketPrice, setDefaultRaffleTicketPrice } from '@/lib/supabase';
import type { Member, CurrentUser } from '@/types';
import { MemberProfileModal } from './MemberProfileModal';
import {
  Shield, Crown, Star, User, Plus, Minus,
  Edit3, Trash2, Search, CheckCircle2,
  AlertTriangle, X, Loader2, Check, ExternalLink,
  Ticket, Settings,
} from 'lucide-react';

interface Props {
  members: Member[];
  onMembersChange: () => void;
  currentUser?: CurrentUser | null;
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-slide-in-right
      ${type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
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

const ROLE_ORDER: Member['role'][] = ['member', 'elder', 'leader'];

const roleConfig = {
  leader: { icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', label: 'Leader' },
  elder:  { icon: Star,  color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20', label: 'Elder'  },
  member: { icon: User,  color: 'text-gray-500',   bg: 'bg-gray-500/10 border-gray-500/20',    label: 'Member' },
};

export function AdminPage({ members, onMembersChange, currentUser }: Props) {
  const [search, setSearch] = useState('');
  const [raffleTicketPrice, setRaffleTicketPrice] = useState<number>(10);
  const [raffleTicketInput, setRaffleTicketInput] = useState('');
  const [savingRafflePrice, setSavingRafflePrice] = useState(false);
  const [editingDkp, setEditingDkp] = useState<Record<string, boolean>>({});
  const [dkpInputs, setDkpInputs] = useState<Record<string, string>>({});
  const [reasonInputs, setReasonInputs] = useState<Record<string, string>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Member | null>(null);
  const [profileMember, setProfileMember] = useState<Member | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const adminName = currentUser?.member.username || 'Admin';

  // Load default raffle ticket price on mount
  useEffect(() => {
    getDefaultRaffleTicketPrice().then((price) => {
      setRaffleTicketPrice(price);
      setRaffleTicketInput(String(price));
    });
  }, []);

  const handleSaveRafflePrice = async () => {
    const price = parseInt(raffleTicketInput);
    if (isNaN(price) || price <= 0) { showToast('Enter a valid price > 0', 'error'); return; }
    setSavingRafflePrice(true);
    try {
      await setDefaultRaffleTicketPrice(price);
      setRaffleTicketPrice(price);
      showToast(`Default raffle ticket price set to ${price} DKP`, 'success');
    } catch { showToast('Failed to save', 'error'); }
    finally { setSavingRafflePrice(false); }
  };

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const filtered = members.filter((m) =>
    m.username.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddDkp = async (id: string, current: number) => {
    const amount = parseInt(dkpInputs[id] || '');
    if (isNaN(amount) || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    const reason = reasonInputs[id]?.trim() || 'Manual adjustment';
    setActionLoading(id);
    try {
      await updateMemberDkp(id, current + amount);
      await createDkpLog({
        member_id: id,
        member_name: members.find((m) => m.id === id)?.username || '',
        amount,
        reason,
        admin_name: adminName,
        dkp_before: current,
        dkp_after: current + amount,
      });
      setEditingDkp((p) => ({ ...p, [id]: false }));
      setDkpInputs((p) => ({ ...p, [id]: '' }));
      setReasonInputs((p) => ({ ...p, [id]: '' }));
      await onMembersChange();
      showToast(`+${amount} DKP added`, 'success');
    } catch { showToast('Failed to update DKP', 'error'); }
    finally { setActionLoading(null); }
  };

  const handleRemoveDkp = async (id: string, current: number) => {
    const amount = parseInt(dkpInputs[id] || '');
    if (isNaN(amount) || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    const reason = reasonInputs[id]?.trim() || 'Manual adjustment';
    const newDkp = Math.max(0, current - amount);
    setActionLoading(id);
    try {
      await updateMemberDkp(id, newDkp);
      await createDkpLog({
        member_id: id,
        member_name: members.find((m) => m.id === id)?.username || '',
        amount: -amount,
        reason,
        admin_name: adminName,
        dkp_before: current,
        dkp_after: newDkp,
      });
      setEditingDkp((p) => ({ ...p, [id]: false }));
      setDkpInputs((p) => ({ ...p, [id]: '' }));
      setReasonInputs((p) => ({ ...p, [id]: '' }));
      await onMembersChange();
      showToast(`-${amount} DKP removed`, 'success');
    } catch { showToast('Failed to update DKP', 'error'); }
    finally { setActionLoading(null); }
  };

  const handleCycleRole = async (id: string, current: Member['role']) => {
    const next = ROLE_ORDER[(ROLE_ORDER.indexOf(current) + 1) % ROLE_ORDER.length];
    setActionLoading(`role-${id}`);
    try {
      await updateMemberRole(id, next);
      await onMembersChange();
      showToast(`Role changed to ${next}`, 'success');
    } catch { showToast('Failed to change role', 'error'); }
    finally { setActionLoading(null); }
  };

  const startRename = (m: Member) => {
    setRenamingId(m.id);
    setRenameValue(m.username);
  };

  const commitRename = async (id: string, original: string) => {
    const name = renameValue.trim();
    if (!name || name === original) { setRenamingId(null); return; }
    setActionLoading(`rename-${id}`);
    try {
      await updateMemberUsername(id, name);
      await onMembersChange();
      showToast(`Renamed to "${name}"`, 'success');
    } catch { showToast('Failed to rename', 'error'); }
    finally { setActionLoading(null); setRenamingId(null); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActionLoading(`del-${confirmDelete.id}`);
    try {
      await deleteMember(confirmDelete.id);
      await onMembersChange();
      showToast(`${confirmDelete.username} removed`, 'success');
    } catch { showToast('Failed to delete member', 'error'); }
    finally { setActionLoading(null); setConfirmDelete(null); }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmDelete && (
        <ConfirmModal
          title={`Remove "${confirmDelete.username}"?`}
          message="This will permanently delete the member and all their data. This cannot be undone."
          confirmLabel="Delete Member"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={!!actionLoading?.startsWith('del-')}
        />
      )}
      {profileMember && (
        <MemberProfileModal member={profileMember} onClose={() => setProfileMember(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2.5 tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center">
              <Shield size={16} className="text-[#D4AF37]" />
            </div>
            Admin Panel
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage members, roles, and DKP</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            className="w-full pl-9 pr-4 py-2.5 bg-black/60 border border-[#1e2d3d] rounded-xl text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
          />
        </div>
      </div>

      {/* ── Raffle Settings ── */}
      <div className="card p-5">
        <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-4">
          <Settings size={14} className="text-[#D4AF37]" /> Raffle Settings
        </h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">
              Default Ticket Price (DKP)
            </label>
            <p className="text-xs text-gray-600 mb-2">
              Applied to all raffles auto-created when shop items expire.
              Currently: <span className="text-purple-400 font-bold">{raffleTicketPrice} DKP</span>
            </p>
            <div className="flex gap-2">
              <div className="relative">
                <Ticket size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="number"
                  min="1"
                  value={raffleTicketInput}
                  onChange={(e) => setRaffleTicketInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveRafflePrice()}
                  placeholder="DKP per ticket"
                  className="pl-9 pr-4 py-2.5 bg-black/60 border border-[#1e2d3d] rounded-xl text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none w-44"
                />
              </div>
              <button
                onClick={handleSaveRafflePrice}
                disabled={savingRafflePrice}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {savingRafflePrice ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Members list */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-gray-600 uppercase tracking-widest font-bold">
            {filtered.length} / {members.length} members
          </span>
        </div>

        <div className="space-y-2">
          {filtered.map((m) => {
            const rc = roleConfig[m.role];
            const RoleIcon = rc.icon;
            const isEditingDkpThis = editingDkp[m.id];
            const isRenamingThis = renamingId === m.id;

            return (
              <div key={m.id}
                className="flex flex-col lg:flex-row lg:items-center justify-between p-4 rounded-xl bg-black/40 border border-[#1a2234] hover:border-[#1e2d3d] transition-colors gap-4">

                {/* Left: avatar + info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <img src={m.avatar} alt="" className="w-11 h-11 rounded-full border-2 border-[#1e2d3d]" />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0d1117] flex items-center justify-center ${rc.bg} border`}>
                      <RoleIcon size={8} className={rc.color} />
                    </div>
                  </div>

                  <div className="min-w-0">
                    {/* Username / rename input */}
                    {isRenamingThis ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(m.id, m.username);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          className="bg-black border border-[rgba(212,175,55,0.4)] rounded-lg px-2 py-1 text-sm w-36 focus:outline-none"
                          autoFocus
                        />
                        <button onClick={() => commitRename(m.id, m.username)}
                          className="p-1 text-green-400 hover:text-green-300">
                          {actionLoading === `rename-${m.id}` ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button onClick={() => setRenamingId(null)} className="p-1 text-gray-600 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm truncate">{m.username}</span>
                        <button onClick={() => startRename(m)} className="text-gray-700 hover:text-[#D4AF37] transition-colors shrink-0">
                          <Edit3 size={11} />
                        </button>
                      </div>
                    )}

                    {/* Role badge + cycle */}
                    <button
                      onClick={() => handleCycleRole(m.id, m.role)}
                      disabled={actionLoading === `role-${m.id}`}
                      className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide transition-all hover:opacity-80 ${rc.bg}`}
                    >
                      {actionLoading === `role-${m.id}`
                        ? <Loader2 size={9} className="animate-spin" />
                        : <RoleIcon size={9} className={rc.color} />}
                      <span className={rc.color}>{m.role}</span>
                    </button>
                  </div>
                </div>

                {/* Right: DKP + actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isEditingDkpThis ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={dkpInputs[m.id] || ''}
                          onChange={(e) => setDkpInputs((p) => ({ ...p, [m.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddDkp(m.id, m.dkp)}
                          type="number"
                          placeholder="Amount"
                          className="w-24 bg-black border border-[#1e2d3d] rounded-lg px-3 py-2 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
                          autoFocus
                        />
                        <button onClick={() => handleAddDkp(m.id, m.dkp)}
                          disabled={actionLoading === m.id}
                          className="p-2 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20 transition-all"
                          title="Add DKP">
                          {actionLoading === m.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        </button>
                        <button onClick={() => handleRemoveDkp(m.id, m.dkp)}
                          disabled={actionLoading === m.id}
                          className="p-2 rounded-lg bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 border border-yellow-500/20 transition-all"
                          title="Remove DKP">
                          <Minus size={14} />
                        </button>
                        <button onClick={() => setEditingDkp((p) => ({ ...p, [m.id]: false }))}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white transition-all">
                          <X size={14} />
                        </button>
                      </div>
                      <input
                        value={reasonInputs[m.id] || ''}
                        onChange={(e) => setReasonInputs((p) => ({ ...p, [m.id]: e.target.value }))}
                        placeholder="Reason (e.g. Event reward, Penalty...)"
                        className="w-full bg-black border border-[#1e2d3d] rounded-lg px-3 py-1.5 text-xs focus:border-[rgba(212,175,55,0.5)] focus:outline-none text-gray-400"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-[#D4AF37] font-black hud-number tabular-nums text-sm px-3 py-1.5 rounded-xl bg-[rgba(212,175,55,0.04)] border border-[rgba(212,175,55,0.15)]">
                        {m.dkp.toLocaleString()} DKP
                      </div>
                      <button
                        onClick={() => setEditingDkp((p) => ({ ...p, [m.id]: true }))}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wide transition-all border border-white/5"
                      >
                        <Edit3 size={12} /> DKP
                      </button>
                      <button
                        onClick={() => setProfileMember(m)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[rgba(212,175,55,0.06)] hover:bg-[rgba(212,175,55,0.1)] text-[rgba(212,175,55,0.6)] hover:text-[#D4AF37] text-xs font-bold uppercase tracking-wide transition-all border border-cyan-500/10"
                        title="View full profile"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setConfirmDelete(m)}
                    className="p-2 rounded-xl bg-red-500/8 hover:bg-red-500/20 text-red-500/60 hover:text-red-400 border border-red-500/10 hover:border-red-500/25 transition-all"
                    title="Delete member"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
