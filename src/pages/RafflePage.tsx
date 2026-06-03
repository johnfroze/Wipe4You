import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  supabase, getRaffles, createRaffle, updateRaffle,
  deleteRaffle, getRaffleEntries, enterRaffle, drawRaffleWinner,
  expireShopItems,
} from '@/lib/supabase';
import type { CurrentUser, Raffle, RaffleEntry } from '@/types';
import {
  Ticket, Plus, Trash2, Trophy, Users,
  X, CheckCircle2, AlertTriangle, Loader2,
  ChevronDown, ChevronUp, Shuffle, Clock,
  Package, CalendarClock, ShieldAlert, RefreshCw,
} from 'lucide-react';

interface Props {
  currentUser: CurrentUser | null;
  onDkpChange: () => void;
}

function Toast({ message, type, onClose }: {
  message: string; type: 'success' | 'error' | 'warning'; onClose: () => void;
}) {
  const styles = {
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    error:   'bg-red-500/10 text-red-400 border-red-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  };
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-slide-in-right border ${styles[type]}`}>
      {type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      {message}
      <button onClick={onClose} className="ml-1 hover:text-white"><X size={13} /></button>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel, loading = false }: {
  title: string; message: string; confirmLabel: string; confirmClass?: string;
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
            className={`px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-50 transition-colors ${confirmClass || 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'}`}>
            {loading && <Loader2 size={13} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Winner Announcement ──────────────────────────────────
function WinnerModal({ name, item, onClose }: { name: string; item: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="bg-[#0d1117] border border-yellow-500/30 rounded-3xl p-8 w-full max-w-md shadow-2xl text-center animate-fade-in">
        {/* Trophy */}
        <div className="w-20 h-20 rounded-full bg-yellow-400/10 border-2 border-yellow-500/30 flex items-center justify-center mx-auto mb-5 animate-pulse-glow">
          <Trophy size={40} className="text-yellow-400" />
        </div>
        <div className="text-yellow-400 text-xs font-black uppercase tracking-widest mb-2">🎉 Raffle Winner 🎉</div>
        <h2 className="text-3xl font-black mb-1 text-glow-gold">{name}</h2>
        <p className="text-gray-400 text-sm mb-6">wins <span className="text-white font-bold">{item}</span></p>
        <button onClick={onClose} className="btn-primary w-full">Awesome!</button>
      </div>
    </div>
  );
}

export function RafflePage({ currentUser, onDkpChange }: Props) {
  const isAdmin = currentUser?.member.role === 'leader' || currentUser?.member.role === 'elder';
  const myId = currentUser?.member.id || '';
  const myUsername = currentUser?.member.username || '';

  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [entries, setEntries] = useState<Record<number, RaffleEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedRaffle, setExpandedRaffle] = useState<number | null>(null);
  const [ticketInputs, setTicketInputs] = useState<Record<number, string>>({});
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [drawingId, setDrawingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [winnerModal, setWinnerModal] = useState<{ name: string; item: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [liveDkp, setLiveDkp] = useState(currentUser?.member.dkp || 0);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formTicketPrice, setFormTicketPrice] = useState('10');
  const [formMaxTickets, setFormMaxTickets] = useState('');
  const [formDrawAt, setFormDrawAt] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const [forceChecking, setForceChecking] = useState(false);

  const handleForceCheck = async () => {
    setForceChecking(true);
    try {
      const count = await expireShopItems();
      if (count > 0) {
        showToast(`${count} expired item${count > 1 ? 's' : ''} transferred to raffle!`, 'success');
        await loadRaffles();
      } else {
        showToast('No expired items found to transfer', 'warning');
      }
    } catch { showToast('Check failed', 'error'); }
    finally { setForceChecking(false); }
  };
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const loadRaffles = useCallback(async () => {
    try {
      setLoading(true);
      // Transfer any newly expired shop items before loading raffles
      await expireShopItems();
      const data = await getRaffles();
      setRaffles(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load raffles', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadEntries = useCallback(async (raffleId: number) => {
    try {
      const data = await getRaffleEntries(raffleId);
      setEntries((prev) => ({ ...prev, [raffleId]: data }));
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    loadRaffles();
    const channel = supabase
      .channel('raffles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raffles' }, loadRaffles)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raffle_entries' }, () => {
        // Reload entries for all expanded raffles
        if (expandedRaffle) loadEntries(expandedRaffle);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadRaffles, loadEntries, expandedRaffle]);

  // Sync live DKP
  useEffect(() => {
    if (currentUser?.member) setLiveDkp(currentUser.member.dkp);
  }, [currentUser]);

  // ── Create Raffle ──
  const handleCreate = async () => {
    if (!formName.trim()) { showToast('Enter a raffle name', 'error'); return; }
    const price = parseInt(formTicketPrice);
    if (isNaN(price) || price <= 0) { showToast('Ticket price must be > 0', 'error'); return; }
    setFormSaving(true);
    try {
      await createRaffle({
        item_id:      null,
        item_name:    formName.trim(),
        item_image:   formImage.trim() || null,
        ticket_price: price,
        max_tickets:  formMaxTickets ? parseInt(formMaxTickets) : null,
        status:       'open',
        draw_at:      formDrawAt ? new Date(formDrawAt).toISOString() : null,
        created_by:   myUsername,
      });
      setFormName(''); setFormImage(''); setFormTicketPrice('10');
      setFormMaxTickets(''); setFormDrawAt('');
      setShowCreateForm(false);
      showToast(`Raffle "${formName}" created!`, 'success');
      await loadRaffles();
    } catch (err) { console.error(err); showToast('Failed to create raffle', 'error'); }
    finally { setFormSaving(false); }
  };

  // ── Buy Tickets ──
  const handleBuyTickets = async (raffle: Raffle) => {
    const count = parseInt(ticketInputs[raffle.id] || '1');
    if (isNaN(count) || count < 1) { showToast('Enter a valid ticket count', 'error'); return; }
    const cost = count * raffle.ticket_price;
    if (liveDkp < cost) {
      showToast(`Not enough DKP — need ${cost.toLocaleString()}, have ${liveDkp.toLocaleString()}`, 'error');
      return;
    }
    setBuyingId(raffle.id);
    try {
      const result = await enterRaffle(raffle.id, myId, count);
      switch (result) {
        case 'ok':
          setLiveDkp((p) => p - cost);
          setTicketInputs((p) => ({ ...p, [raffle.id]: '' }));
          await onDkpChange();
          await loadRaffles();
          if (expandedRaffle === raffle.id) await loadEntries(raffle.id);
          showToast(`${count} ticket${count > 1 ? 's' : ''} bought for ${cost.toLocaleString()} DKP!`, 'success');
          break;
        case 'insufficient_dkp':  showToast('Not enough DKP', 'error'); break;
        case 'raffle_closed':     showToast('This raffle is no longer open', 'error'); break;
        case 'tickets_full':      showToast('No tickets remaining', 'error'); break;
        default:                  showToast('Purchase failed', 'error');
      }
    } catch (err) { console.error(err); showToast('Failed to buy tickets', 'error'); }
    finally { setBuyingId(null); }
  };

  // ── Draw Winner ──
  const handleDraw = async (raffle: Raffle) => {
    setDrawingId(raffle.id);
    try {
      const winner = await drawRaffleWinner(raffle.id);
      await loadRaffles();
      if (winner === 'no_entries') {
        showToast('No entries — raffle closed with no winner', 'warning');
      } else if (winner === 'raffle_not_open') {
        showToast('Raffle is not open', 'error');
      } else {
        setWinnerModal({ name: winner, item: raffle.item_name });
      }
    } catch (err) { console.error(err); showToast('Draw failed', 'error'); }
    finally { setDrawingId(null); }
  };

  // ── Delete Raffle ──
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      await deleteRaffle(deleteConfirm);
      await loadRaffles();
      showToast('Raffle deleted', 'success');
    } catch { showToast('Delete failed', 'error'); }
    finally { setDeleteLoading(false); setDeleteConfirm(null); }
  };

  // ── Cancel Raffle ──
  const handleCancel = async (id: number) => {
    try {
      await updateRaffle(id, { status: 'cancelled' });
      await loadRaffles();
      showToast('Raffle cancelled', 'success');
    } catch { showToast('Failed to cancel', 'error'); }
  };

  // Toggle entries panel
  const toggleExpand = async (id: number) => {
    if (expandedRaffle === id) { setExpandedRaffle(null); return; }
    setExpandedRaffle(id);
    await loadEntries(id);
  };

  const openRaffles = useMemo(() => raffles.filter((r) => r.status === 'open'), [raffles]);
  const closedRaffles = useMemo(() => raffles.filter((r) => r.status !== 'open'), [raffles]);

  // Per-raffle: how many tickets the current user has
  const myTickets = (raffleId: number) =>
    (entries[raffleId] || []).filter((e) => e.member_id === myId)
      .reduce((sum, e) => sum + e.tickets, 0);

  const winChance = (raffle: Raffle, raffleId: number) => {
    const mine = myTickets(raffleId);
    if (!mine || !raffle.tickets_sold) return null;
    return ((mine / raffle.tickets_sold) * 100).toFixed(1);
  };

  // ─────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {winnerModal && (
        <WinnerModal
          name={winnerModal.name}
          item={winnerModal.item}
          onClose={() => setWinnerModal(null)}
        />
      )}
      {deleteConfirm !== null && (
        <ConfirmModal
          title="Delete Raffle"
          message="This permanently deletes the raffle and all ticket entries. This cannot be undone."
          confirmLabel="Delete"
          confirmClass="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
          loading={deleteLoading}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2.5 tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-purple-400/10 border border-purple-400/20 flex items-center justify-center">
              <Ticket size={16} className="text-purple-400" />
            </div>
            Raffle
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {openRaffles.length} open · Your balance:{' '}
            <span className="text-cyan-400 font-bold hud-number">{liveDkp.toLocaleString()} DKP</span>
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={handleForceCheck}
              disabled={forceChecking}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 text-sm font-bold transition-all disabled:opacity-50"
              title="Manually check for expired shop items and transfer them to raffle"
            >
              {forceChecking
                ? <Loader2 size={15} className="animate-spin" />
                : <RefreshCw size={15} />}
              Check Expired
            </button>
            {!showCreateForm && (
              <button onClick={() => setShowCreateForm(true)} className="btn-primary flex items-center gap-2">
                <Plus size={15} /> Create Raffle
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Create Form ── */}
      {showCreateForm && isAdmin && (
        <div className="card p-5 animate-fade-in space-y-4 border-purple-500/20">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Ticket size={14} className="text-purple-400" /> New Raffle
          </h3>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Prize Name *</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Dragon Sword +8"
                className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm focus:border-purple-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Prize Image URL (optional)</label>
              <input value={formImage} onChange={(e) => setFormImage(e.target.value)}
                placeholder="https://..."
                className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm focus:border-purple-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ticket Price (DKP) *</label>
              <input value={formTicketPrice} onChange={(e) => setFormTicketPrice(e.target.value)}
                type="number" min="1" placeholder="10"
                className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm focus:border-purple-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Max Tickets (optional — blank = unlimited)</label>
              <input value={formMaxTickets} onChange={(e) => setFormMaxTickets(e.target.value)}
                type="number" min="1" placeholder="Unlimited"
                className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm focus:border-purple-500/50 focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Auto-Draw Date (optional)</label>
              <div className="relative">
                <CalendarClock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="datetime-local" value={formDrawAt} onChange={(e) => setFormDrawAt(e.target.value)}
                  className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl pl-9 pr-3 py-3 text-sm focus:border-purple-500/50 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Preview */}
          {formName && (
            <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/15 text-xs text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Prize</span>
                <span className="text-white font-bold">{formName}</span>
              </div>
              <div className="flex justify-between">
                <span>Ticket price</span>
                <span className="text-purple-400 font-bold">{parseInt(formTicketPrice) || 0} DKP / ticket</span>
              </div>
              {formMaxTickets && (
                <div className="flex justify-between">
                  <span>Max tickets</span>
                  <span className="text-white font-bold">{formMaxTickets}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowCreateForm(false)} disabled={formSaving}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm transition-colors">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={formSaving}
              className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {formSaving ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
              Create Raffle
            </button>
          </div>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && raffles.length === 0 && (
        <div className="card p-16 text-center">
          <Ticket size={48} className="mx-auto text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">No raffles yet</p>
          {isAdmin && <p className="text-gray-600 text-sm mt-1">Create the first raffle above</p>}
        </div>
      )}

      {/* ── Open Raffles ── */}
      {openRaffles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">
              Open — {openRaffles.length}
            </span>
          </div>

          <div className="space-y-4">
            {openRaffles.map((raffle) => {
              const isExpanded = expandedRaffle === raffle.id;
              const raffleEntries = entries[raffle.id] || [];
              const isBuying = buyingId === raffle.id;
              const myTicketCount = myTickets(raffle.id);
              const chance = winChance(raffle, raffle.id);
              const soldPct = raffle.max_tickets
                ? Math.round((raffle.tickets_sold / raffle.max_tickets) * 100) : null;
              const isFull = raffle.max_tickets !== null && raffle.tickets_sold >= raffle.max_tickets;

              return (
                <div key={raffle.id} className="card overflow-hidden border-purple-500/15">

                  {/* Image */}
                  {raffle.item_image && (
                    <div className="h-44 bg-black overflow-hidden relative">
                      <img src={raffle.item_image} alt={raffle.item_name}
                        className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-3 left-4">
                        <h3 className="text-xl font-black">{raffle.item_name}</h3>
                      </div>
                    </div>
                  )}

                  <div className="p-5 space-y-4">
                    {!raffle.item_image && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                          <Package size={18} className="text-purple-400" />
                        </div>
                        <h3 className="text-lg font-black">{raffle.item_name}</h3>
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 rounded-xl bg-black/40 border border-[#1e2d3d] text-center">
                        <div className="text-lg font-black text-purple-400 hud-number">
                          {raffle.ticket_price}
                        </div>
                        <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-0.5">DKP/ticket</div>
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-[#1e2d3d] text-center">
                        <div className="text-lg font-black text-white hud-number">
                          {raffle.tickets_sold}
                          {raffle.max_tickets && <span className="text-gray-600 text-sm font-normal">/{raffle.max_tickets}</span>}
                        </div>
                        <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-0.5">Tickets Sold</div>
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-[#1e2d3d] text-center">
                        <div className="text-lg font-black text-cyan-400 hud-number">
                          {myTicketCount}
                        </div>
                        <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-0.5">Your Tickets</div>
                      </div>
                    </div>

                    {/* Progress bar (if max tickets set) */}
                    {soldPct !== null && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Tickets sold</span>
                          <span className={soldPct >= 90 ? 'text-red-400' : soldPct >= 60 ? 'text-yellow-400' : 'text-purple-400'}>
                            {soldPct}%
                          </span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill"
                            style={{
                              width: `${soldPct}%`,
                              background: soldPct >= 90 ? '#ef4444' : soldPct >= 60 ? '#f59e0b' : '#a855f7',
                            }} />
                        </div>
                      </div>
                    )}

                    {/* Win chance */}
                    {chance && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/5 border border-purple-500/15 text-xs text-purple-300">
                        <Trophy size={12} className="text-purple-400" />
                        Your current win chance: <span className="font-black text-purple-400 ml-1">{chance}%</span>
                      </div>
                    )}

                    {/* Scheduled draw */}
                    {raffle.draw_at && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock size={11} />
                        Scheduled draw: {new Date(raffle.draw_at).toLocaleString()}
                      </div>
                    )}

                    {/* Ticket purchase */}
                    {!isFull ? (
                      <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-black/60 border border-[#1e2d3d] rounded-xl px-3 focus-within:border-purple-500/50 transition-colors">
                          <Ticket size={14} className="text-purple-400 shrink-0" />
                          <input
                            type="number"
                            min="1"
                            value={ticketInputs[raffle.id] || ''}
                            onChange={(e) => setTicketInputs((p) => ({ ...p, [raffle.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleBuyTickets(raffle)}
                            placeholder="# of tickets"
                            className="bg-transparent flex-1 py-2.5 text-sm outline-none"
                          />
                          {ticketInputs[raffle.id] && (
                            <span className="text-xs text-purple-400 font-bold tabular-nums shrink-0">
                              = {(parseInt(ticketInputs[raffle.id] || '0') || 0) * raffle.ticket_price} DKP
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleBuyTickets(raffle)}
                          disabled={isBuying}
                          style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}
                          className="px-5 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 flex items-center gap-2 hover:opacity-90 transition-opacity shadow-[0_0_20px_#a855f733]"
                        >
                          {isBuying
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Ticket size={14} />}
                          Enter
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/8 border border-red-500/15 text-red-400 text-sm font-bold">
                        <ShieldAlert size={15} /> Tickets sold out
                      </div>
                    )}

                    {/* Entries toggle + admin actions */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => toggleExpand(raffle.id)}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        <Users size={12} />
                        {raffle.tickets_sold} ticket{raffle.tickets_sold !== 1 ? 's' : ''} — view entries
                      </button>

                      {isAdmin && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDraw(raffle)}
                            disabled={drawingId === raffle.id || raffle.tickets_sold === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 text-xs font-bold transition-all disabled:opacity-40"
                          >
                            {drawingId === raffle.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <Shuffle size={12} />}
                            Draw Winner
                          </button>
                          <button
                            onClick={() => handleCancel(raffle.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-500/10 text-gray-500 border border-gray-500/15 hover:bg-gray-500/20 text-xs font-bold transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Entries list */}
                    {isExpanded && (
                      <div className="border-t border-[#1e2d3d] pt-3 animate-fade-in space-y-1.5">
                        <div className="text-xs text-gray-600 uppercase tracking-wider font-bold mb-2">
                          Participants ({raffleEntries.length})
                        </div>
                        {raffleEntries.length === 0 ? (
                          <p className="text-gray-600 text-xs text-center py-4">No entries yet</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {raffleEntries.map((entry) => (
                              <div key={entry.id}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                                  entry.member_id === myId
                                    ? 'bg-purple-500/5 border-purple-500/20'
                                    : 'bg-black/30 border-[#1e2d3d]'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Users size={11} className="text-gray-600" />
                                  <span className={entry.member_id === myId ? 'text-purple-300 font-bold' : 'text-gray-300'}>
                                    {entry.member_name}
                                    {entry.member_id === myId && <span className="text-purple-600 ml-1">(you)</span>}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-purple-400 font-black tabular-nums">
                                    {entry.tickets}x
                                  </span>
                                  <span className="text-gray-600 tabular-nums">
                                    {entry.total_cost} DKP
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Completed / Cancelled Raffles ── */}
      {closedRaffles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-gray-600" />
            <span className="text-xs font-black uppercase tracking-widest text-gray-600">
              Ended — {closedRaffles.length}
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {closedRaffles.map((raffle) => (
              <div key={raffle.id} className="card p-4 opacity-70 hover:opacity-90 transition-opacity">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gray-500/10 border border-gray-500/15 flex items-center justify-center">
                      <Ticket size={14} className="text-gray-500" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm">{raffle.item_name}</h3>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        raffle.status === 'completed' ? 'text-green-500' :
                        raffle.status === 'cancelled' ? 'text-red-500' : 'text-gray-500'
                      }`}>{raffle.status}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => setDeleteConfirm(raffle.id)}
                      className="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-all">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Winner */}
                {raffle.winner_name && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-500/8 border border-yellow-500/20 mb-2">
                    <Trophy size={13} className="text-yellow-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">Winner</div>
                      <div className="text-sm font-black text-yellow-400">{raffle.winner_name}</div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-[10px] text-gray-500">Total entries</div>
                      <div className="text-sm font-bold text-gray-300 tabular-nums">{raffle.tickets_sold}</div>
                    </div>
                  </div>
                )}

                {raffle.status === 'cancelled' && (
                  <p className="text-xs text-gray-600 text-center py-1">Raffle was cancelled</p>
                )}

                {raffle.completed_at && (
                  <p className="text-[11px] text-gray-700 mt-1">
                    Drawn on {new Date(raffle.completed_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
