import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Returns current local datetime in the format datetime-local inputs expect
// e.g. "2026-06-05T14:30" — pre-filled as default, user can adjust
function getLocalDateTimeString(offsetHours = 0): string {
  const d = new Date(Date.now() + offsetHours * 3600000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

import {
  supabase,
  getRaffles, createRaffle, deleteRaffle,
  getRafflePrizes, addRafflePrize,
  getRaffleEntries, enterRaffle, drawRaffleWinners,
  getExpiredQueuedItems, assignItemsToRaffle,
  expireShopItems, getDistinctEventNames,
  cancelRaffleWithRefund,
} from '@/lib/supabase';
import type { CurrentUser, Raffle, RafflePrize, RaffleEntry } from '@/types';
import {
  Ticket, Plus, Trash2, Trophy, Users,
  X, CheckCircle2, AlertTriangle, Loader2,
  ChevronDown, ChevronUp, Shuffle, Clock,
  Package, CalendarClock, RefreshCw,
  Gift, Crown, Info, ShieldCheck, Lock,
} from 'lucide-react';

interface Props {
  currentUser: CurrentUser | null;
  onDkpChange: () => void;
}

interface QueuedItem {
  id: number;
  name: string;
  image_url: string | null;
  price: number;
  current_stock: number;
  expires_at: string | null;
  raffle_id: number | null;
}

// ─── Toast ────────────────────────────────────────────────
function Toast({ message, type, onClose }: {
  message: string; type: 'success' | 'error' | 'warning'; onClose: () => void;
}) {
  const s = {
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    error:   'bg-red-500/10 text-red-400 border-red-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  };
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-slide-in-right border ${s[type]}`}>
      {type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      {message}
      <button onClick={onClose} className="ml-1 hover:text-white"><X size={13} /></button>
    </div>
  );
}

// ─── Winners Announcement ─────────────────────────────────
function WinnersModal({
  results, onClose,
}: {
  results: { prize: string; winner: string }[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-[#0a0810] border border-yellow-500/30 rounded-3xl p-8 w-full max-w-lg shadow-2xl text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-yellow-400/10 border-2 border-yellow-500/30 flex items-center justify-center mx-auto mb-5 animate-pulse-glow">
          <Trophy size={40} className="text-yellow-400" />
        </div>
        <div className="text-yellow-400 text-xs font-black uppercase tracking-widest mb-3">
          🎉 Raffle Results 🎉
        </div>

        <div className="space-y-3 mb-6 text-left">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/20">
              <div className="w-8 h-8 rounded-lg bg-yellow-400/20 flex items-center justify-center shrink-0">
                <Gift size={16} className="text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 truncate">{r.prize}</div>
                <div className="font-black text-white flex items-center gap-1.5">
                  <Crown size={12} className="text-yellow-400" />
                  {r.winner}
                </div>
              </div>
              <CheckCircle2 size={16} className="text-green-400 shrink-0" />
            </div>
          ))}
        </div>

        <button onClick={onClose} className="btn-primary w-full">
          Awesome!
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
export function RafflePage({ currentUser, onDkpChange }: Props) {
  const isAdmin = currentUser?.member.role === 'leader' || currentUser?.member.role === 'elder';
  const myId = currentUser?.member.id || '';

  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [prizes, setPrizes] = useState<Record<number, RafflePrize[]>>({});
  const [entries, setEntries] = useState<Record<number, RaffleEntry[]>>({});
  const [queuedItems, setQueuedItems] = useState<QueuedItem[]>([]);
  const [eventNames, setEventNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRaffle, setExpandedRaffle] = useState<number | null>(null);
  const [ticketInputs, setTicketInputs] = useState<Record<number, string>>({});
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [drawingId, setDrawingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [winnersModal, setWinnersModal] = useState<{ prize: string; winner: string }[] | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [forceChecking, setForceChecking] = useState(false);
  const [liveDkp, setLiveDkp] = useState(currentUser?.member.dkp || 0);
  const [myAttendedEvents, setMyAttendedEvents] = useState<Set<string>>(new Set());

  // Load events this member has attended (for eligibility check)
  const loadMyAttendance = useCallback(async () => {
    if (!myId) return;
    const { data } = await supabase
      .from('attendance_log')
      .select('event_name')
      .eq('member_id', myId);
    if (data) {
      setMyAttendedEvents(new Set(data.map((r: any) => (r.event_name as string).toLowerCase())));
    }
  }, [myId]);

  // Create form
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTicketPrice, setFormTicketPrice] = useState('10');
  const [formMaxTickets, setFormMaxTickets] = useState('');
  const [formDrawAt, setFormDrawAt] = useState(() => getLocalDateTimeString(24));
  const [formRequiredEvent, setFormRequiredEvent] = useState('');
  const [formSelectedItems, setFormSelectedItems] = useState<Set<number>>(new Set());
  const [formSaving, setFormSaving] = useState(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const loadPrizesAndEntries = useCallback(async (raffleId: number) => {
    const [p, e] = await Promise.all([
      getRafflePrizes(raffleId),
      getRaffleEntries(raffleId),
    ]);
    setPrizes((prev) => ({ ...prev, [raffleId]: p }));
    setEntries((prev) => ({ ...prev, [raffleId]: e }));
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await expireShopItems();
      const [raffleData, queueData, eventData] = await Promise.all([
        getRaffles(),
        getExpiredQueuedItems(),
        getDistinctEventNames(),
      ]);
      setRaffles(raffleData);
      setQueuedItems(queueData as QueuedItem[]);
      setEventNames(eventData);

      // Auto-load prizes for all completed/cancelled raffles
      // so winner summaries are visible without clicking expand
      const closedIds = raffleData
        .filter((r) => r.status !== 'open')
        .map((r) => r.id);
      await Promise.all(closedIds.map((id) => loadPrizesAndEntries(id)));
    } catch (err) {
      console.error(err);
      showToast('Failed to load raffles', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, loadPrizesAndEntries]);

  useEffect(() => {
    loadAll();
    loadMyAttendance();
    const channel = supabase
      .channel('raffles-v2-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raffles' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_items' }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAll, loadMyAttendance]);

  // Only set liveDkp on mount — optimistic updates handle
  // subsequent changes so attendance DKP gains don't
  // overwrite DKP already spent on tickets
  const hasSetInitialDkp = useRef(false);
  useEffect(() => {
    if (currentUser?.member && !hasSetInitialDkp.current) {
      setLiveDkp(currentUser.member.dkp);
      hasSetInitialDkp.current = true;
    }
  }, [currentUser]);

  // Realtime: keep liveDkp in sync with actual DB value
  // so refunds, admin adjustments, and attendance gains
  // are reflected without overwriting ticket purchase deductions
  useEffect(() => {
    if (!currentUser?.member?.id) return;
    const channel = supabase
      .channel('raffle-page-dkp')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'members',
        filter: `id=eq.${currentUser.member.id}`,
      }, (payload: any) => {
        if (payload.new?.dkp !== undefined) {
          setLiveDkp(payload.new.dkp);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // ── Force check ──
  const handleForceCheck = useCallback(async () => {
    setForceChecking(true);
    try {
      const count = await expireShopItems();
      const queueData = await getExpiredQueuedItems();
      setQueuedItems(queueData as QueuedItem[]);
      if (count > 0) {
        showToast(`${count} expired item${count > 1 ? 's' : ''} added to queue!`, 'success');
      } else {
        showToast('No new expired items found', 'warning');
      }
    } catch (err: any) {
      showToast(`Error: ${err?.message || 'Check failed'}`, 'error');
    } finally { setForceChecking(false); }
  }, [showToast]);

  // ── Create Raffle ──
  const handleCreate = async () => {
    if (!formTitle.trim()) { showToast('Enter a raffle title', 'error'); return; }
    const price = parseInt(formTicketPrice);
    if (isNaN(price) || price <= 0) { showToast('Ticket price must be > 0', 'error'); return; }
    if (formSelectedItems.size === 0) { showToast('Select at least one item as prize', 'error'); return; }

    setFormSaving(true);
    try {
      const selectedItemObjects = queuedItems.filter((i) => formSelectedItems.has(i.id));

      // Total winners = sum of all stock quantities across selected items
      const totalWinners = selectedItemObjects.reduce(
        (sum, item) => sum + Math.max(1, item.current_stock),
        0
      );

      const raffleId = await createRaffle({
        title:               formTitle.trim(),
        description:         formDesc.trim() || null,
        ticket_price:        price,
        max_tickets:         formMaxTickets ? parseInt(formMaxTickets) : null,
        winner_count:        totalWinners,
        draw_at:             formDrawAt ? new Date(formDrawAt).toISOString() : null,
        required_event_name: formRequiredEvent.trim() || null,
        created_by:          currentUser?.member.username || 'Admin',
      });

      // Add one prize slot per unit of stock for each selected item
      for (const item of selectedItemObjects) {
        const units = Math.max(1, item.current_stock);
        for (let u = 0; u < units; u++) {
          await addRafflePrize({
            raffle_id:  raffleId,
            item_id:    item.id,
            item_name:  units > 1 ? `${item.name} #${u + 1}` : item.name,
            item_image: item.image_url,
          });
        }
      }

      // Mark items as assigned to this raffle
      await assignItemsToRaffle(Array.from(formSelectedItems), raffleId);

      const t = formTitle;
      const sz = formSelectedItems.size;
      setFormTitle(''); setFormDesc(''); setFormTicketPrice('10');
      setFormMaxTickets(''); setFormDrawAt(''); setFormRequiredEvent('');
      setFormSelectedItems(new Set());
      setShowCreateForm(false);
      showToast(
        `Raffle "${t}" created — ${totalWinners} prize slot${totalWinners > 1 ? 's' : ''} from ${sz} item${sz > 1 ? 's' : ''}!`,
        'success'
      );
      await loadAll();
    } catch (err: any) {
      console.error(err);
      showToast(`Failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally { setFormSaving(false); }
  };

  // ── Buy Tickets ──
  // ── Confirm modal state ──
  const [confirmBuy, setConfirmBuy] = useState<{ raffle: Raffle; count: number; cost: number } | null>(null);
  const [confirmBuyLoading, setConfirmBuyLoading] = useState(false);

  // Step 1: validate and open confirmation modal
  const handleBuyTickets = (raffle: Raffle) => {
    const count = parseInt(ticketInputs[raffle.id] || '1');
    if (isNaN(count) || count < 1) { showToast('Enter a valid ticket count', 'error'); return; }
    const cost = count * raffle.ticket_price;
    if (liveDkp < cost) {
      showToast(`Not enough DKP — need ${cost.toLocaleString()}, have ${liveDkp.toLocaleString()}`, 'error');
      return;
    }
    setConfirmBuy({ raffle, count, cost });
  };

  // Step 2: actually purchase after confirmation
  const executeBuyTickets = async () => {
    if (!confirmBuy) return;
    const { raffle, count, cost } = confirmBuy;
    setConfirmBuyLoading(true);
    setBuyingId(raffle.id);
    try {
      const result = await enterRaffle(raffle.id, myId, count);
      switch (result) {
        case 'ok':
          setLiveDkp((p) => p - cost);
          setTicketInputs((p) => ({ ...p, [raffle.id]: '' }));
          await onDkpChange();
          await loadPrizesAndEntries(raffle.id);
          await loadAll();
          showToast(`${count} ticket${count > 1 ? 's' : ''} bought for ${cost.toLocaleString()} DKP!`, 'success');
          break;
        case 'not_eligible':
          showToast(`You must have attended "${raffle.required_event_name}" to enter this raffle`, 'error');
          break;
        case 'insufficient_dkp': showToast('Not enough DKP', 'error'); break;
        case 'raffle_closed':    showToast('This raffle is no longer open', 'error'); break;
        case 'tickets_full':     showToast('No tickets remaining', 'error'); break;
        default:                 showToast('Purchase failed', 'error');
      }
    } catch (err) { console.error(err); showToast('Failed to buy tickets', 'error'); }
    finally {
      setBuyingId(null);
      setConfirmBuyLoading(false);
      setConfirmBuy(null);
    }
  };

  // ── Draw Winners ──
  const handleDraw = async (raffle: Raffle) => {
    setDrawingId(raffle.id);
    try {
      const result = await drawRaffleWinners(raffle.id);
      await loadAll();
      if ('error' in result) {
        if (result.error === 'no_entries') showToast('No entries — raffle closed with no winners', 'warning');
        else if (result.error === 'raffle_not_open') showToast('Raffle is not open', 'error');
        else showToast(`Draw failed: ${result.error}`, 'error');
      } else {
        setWinnersModal(result);
      }
    } catch (err: any) {
      showToast(`Draw failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally { setDrawingId(null); }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      await deleteRaffle(deleteConfirm);
      await loadAll();
      showToast('Raffle deleted', 'success');
    } catch { showToast('Delete failed', 'error'); }
    finally { setDeleteLoading(false); setDeleteConfirm(null); }
  };

  // ── Cancel with full DKP refund ──
  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const handleCancelWithRefund = async () => {
    if (!cancelConfirm) return;
    setCancelLoading(true);
    try {
      const refunded = await cancelRaffleWithRefund(cancelConfirm);
      await onDkpChange();
      await loadAll();
      showToast(
        refunded > 0
          ? `Raffle cancelled — ${refunded} member${refunded > 1 ? 's' : ''} refunded`
          : 'Raffle cancelled (no entries to refund)',
        'success'
      );
    } catch (err: any) {
      showToast(`Cancel failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setCancelLoading(false);
      setCancelConfirm(null);
    }
  };

  // Toggle expand
  const toggleExpand = async (id: number) => {
    if (expandedRaffle === id) { setExpandedRaffle(null); return; }
    setExpandedRaffle(id);
    await loadPrizesAndEntries(id);
  };

  const openRaffles   = useMemo(() => raffles.filter((r) => r.status === 'open'), [raffles]);
  const closedRaffles = useMemo(() => raffles.filter((r) => r.status !== 'open'), [raffles]);

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

      {winnersModal && (
        <WinnersModal results={winnersModal} onClose={() => setWinnersModal(null)} />
      )}

      {confirmBuy && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0a0810] border border-purple-500/25 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
                <Ticket size={18} className="text-purple-400" />
              </div>
              <div>
                <h3 className="font-black text-base">Confirm Ticket Purchase</h3>
                <p className="text-xs text-gray-500">{confirmBuy.raffle.title}</p>
              </div>
            </div>

            <div className="space-y-2 p-4 rounded-xl bg-black/40 border border-[rgba(212,175,55,0.1)]">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tickets</span>
                <span className="font-bold text-white">{confirmBuy.count}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Price per ticket</span>
                <span className="font-bold text-gray-300">{confirmBuy.raffle.ticket_price.toLocaleString()} DKP</span>
              </div>
              <div className="h-px bg-[rgba(212,175,55,0.1)] my-1" />
              <div className="flex justify-between">
                <span className="text-sm font-bold text-gray-400">Total cost</span>
                <span className="text-lg font-black text-purple-400">{confirmBuy.cost.toLocaleString()} DKP</span>
              </div>
              <div className="flex justify-between text-xs pt-1">
                <span className="text-gray-600">Balance after purchase</span>
                <span className="text-gray-500 font-bold">
                  {(liveDkp - confirmBuy.cost).toLocaleString()} DKP
                </span>
              </div>
            </div>

            <p className="text-[11px] text-gray-600 text-center">
              This will immediately deduct DKP from your balance. Purchases cannot be refunded unless the raffle is cancelled by an admin.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmBuy(null)}
                disabled={confirmBuyLoading}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeBuyTickets}
                disabled={confirmBuyLoading}
                style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                {confirmBuyLoading ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
                Confirm Purchase
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0810] border border-[rgba(212,175,55,0.1)] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-fade-in">
            <h3 className="font-bold">Delete Raffle</h3>
            <p className="text-sm text-gray-400">This permanently deletes the raffle, all prizes, and all entries.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-gray-300">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-sm bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 flex items-center gap-2 disabled:opacity-50">
                {deleteLoading && <Loader2 size={13} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelConfirm !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0810] border border-[rgba(212,175,55,0.1)] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-fade-in">
            <h3 className="font-bold flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-400" /> Cancel Raffle
            </h3>
            <p className="text-sm text-gray-400">
              This will cancel the raffle and <span className="text-yellow-400 font-bold">fully refund all DKP</span> spent on tickets to every participant. Their refunds will also appear in the DKP Log.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCancelConfirm(null)} disabled={cancelLoading}
                className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-gray-300">
                Keep Raffle
              </button>
              <button onClick={handleCancelWithRefund} disabled={cancelLoading}
                className="px-4 py-2 rounded-xl text-sm bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 flex items-center gap-2 disabled:opacity-50">
                {cancelLoading && <Loader2 size={13} className="animate-spin" />}
                Cancel & Refund All
              </button>
            </div>
          </div>
        </div>
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
            <span className="text-[#D4AF37] font-bold hud-number">{liveDkp.toLocaleString()} DKP</span>
          </p>
        </div>

        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleForceCheck} disabled={forceChecking}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 border border-white/5 text-sm font-bold transition-all disabled:opacity-50">
              {forceChecking ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Check Expired
            </button>
            {!showCreateForm && (
              <button onClick={() => setShowCreateForm(true)}
                className="btn-primary flex items-center gap-2">
                <Plus size={15} /> Create Raffle
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Expired Items Queue (admin only) ── */}
      {isAdmin && (
        <div className={`card p-4 ${queuedItems.length > 0 ? 'border-purple-500/20' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <Package size={13} className="text-purple-400" />
            </div>
            <h3 className="font-bold text-sm text-gray-300">
              Expired Items Queue
            </h3>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
              queuedItems.length > 0
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/25'
                : 'bg-white/5 text-gray-600'
            }`}>
              {queuedItems.length}
            </span>
          </div>

          {queuedItems.length === 0 ? (
            <p className="text-gray-600 text-xs">
              No expired items waiting. When shop items expire, they appear here for you to assign to a raffle.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {queuedItems.map((item) => (
                <div key={item.id}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-[rgba(212,175,55,0.1)]">
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    : <div className="w-8 h-8 rounded-lg bg-[#1e2d3d] flex items-center justify-center shrink-0">
                        <Package size={14} className="text-gray-600" />
                      </div>
                  }
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{item.name}</div>
                    <div className="text-[10px] text-gray-600 flex items-center gap-1">
                      <span>{item.expires_at ? new Date(item.expires_at).toLocaleDateString() : ''}</span>
                      <span className="text-gray-700">·</span>
                      <span className="text-purple-500 font-bold">{Math.max(1, item.current_stock)}x</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create Raffle Form ── */}
      {showCreateForm && isAdmin && (
        <div className="card p-5 animate-fade-in border-purple-500/20 space-y-5">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Ticket size={14} className="text-purple-400" /> New Raffle
          </h3>

          {/* Basic settings */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Raffle Title *</label>
              <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Weekly Gear Raffle"
                className="w-full bg-black/60 border border-[rgba(212,175,55,0.1)] rounded-xl p-3 text-sm focus:border-purple-500/50 focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
              <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                rows={2} placeholder="Tell members what this raffle is about..."
                className="w-full bg-black/60 border border-[rgba(212,175,55,0.1)] rounded-xl p-3 text-sm focus:border-purple-500/50 focus:outline-none resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ticket Price (DKP) *</label>
              <input value={formTicketPrice} onChange={(e) => setFormTicketPrice(e.target.value)}
                type="number" min="1" placeholder="10"
                className="w-full bg-black/60 border border-[rgba(212,175,55,0.1)] rounded-xl p-3 text-sm focus:border-purple-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Max Tickets (optional)</label>
              <input value={formMaxTickets} onChange={(e) => setFormMaxTickets(e.target.value)}
                type="number" min="1" placeholder="Unlimited"
                className="w-full bg-black/60 border border-[rgba(212,175,55,0.1)] rounded-xl p-3 text-sm focus:border-purple-500/50 focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Draw Date (optional)</label>
              <div className="relative">
                <CalendarClock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="datetime-local" value={formDrawAt} onChange={(e) => setFormDrawAt(e.target.value)}
                  className="w-full bg-black/60 border border-[rgba(212,175,55,0.1)] rounded-xl pl-9 pr-3 py-3 text-sm focus:border-purple-500/50 focus:outline-none" />
              </div>
            </div>

            {/* Attendance gate */}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1.5 block">
                <ShieldCheck size={12} className="text-purple-400" />
                Attendance Requirement (optional)
              </label>
              <p className="text-[11px] text-gray-600 mb-2">
                Only members who attended this event can buy tickets. Leave blank for open entry.
              </p>
              <div className="flex gap-2">
                <select
                  value={formRequiredEvent}
                  onChange={(e) => setFormRequiredEvent(e.target.value)}
                  className="flex-1 bg-black/60 border border-[rgba(212,175,55,0.1)] rounded-xl px-3 py-3 text-sm focus:border-purple-500/50 focus:outline-none appearance-none"
                >
                  <option value="">— Open to all members —</option>
                  {eventNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {formRequiredEvent && (
                  <button
                    type="button"
                    onClick={() => setFormRequiredEvent('')}
                    className="px-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white transition-colors text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
              {formRequiredEvent && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/8 border border-purple-500/20 text-xs text-purple-300">
                  <Lock size={11} className="text-purple-400" />
                  Only members who attended <span className="font-bold text-white mx-1">"{formRequiredEvent}"</span> can enter
                </div>
              )}
            </div>
          </div>

          {/* Select prizes from expired queue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 uppercase tracking-wider font-bold">
                Select Prize Items *
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-purple-400 font-bold">
                  {formSelectedItems.size} item{formSelectedItems.size !== 1 ? 's' : ''}
                  {' · '}
                  {queuedItems
                    .filter((i) => formSelectedItems.has(i.id))
                    .reduce((sum, i) => sum + Math.max(1, i.current_stock), 0)
                  } prize slot{
                    queuedItems
                      .filter((i) => formSelectedItems.has(i.id))
                      .reduce((sum, i) => sum + Math.max(1, i.current_stock), 0) !== 1 ? 's' : ''
                  } · same number of winners
                </span>
                {/* Select All / Deselect All */}
                {queuedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (formSelectedItems.size === queuedItems.length) {
                        // All selected → deselect all
                        setFormSelectedItems(new Set());
                      } else {
                        // Some or none → select all
                        setFormSelectedItems(new Set(queuedItems.map((i) => i.id)));
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                      formSelectedItems.size === queuedItems.length
                        ? 'bg-purple-500/20 border-purple-500/35 text-purple-300 hover:bg-purple-500/10'
                        : 'bg-[rgba(212,175,55,0.08)] border-[rgba(212,175,55,0.2)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.15)]'
                    }`}
                  >
                    {formSelectedItems.size === queuedItems.length ? (
                      <>
                        <X size={11} /> Deselect All
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={11} /> Select All ({queuedItems.length})
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {queuedItems.length === 0 ? (
              <div className="p-4 rounded-xl bg-black/40 border border-[rgba(212,175,55,0.1)] text-center">
                <Info size={16} className="mx-auto text-gray-600 mb-1" />
                <p className="text-gray-600 text-xs">No expired items in queue. Items appear here when they expire in the shop.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {queuedItems.map((item) => {
                  const selected = formSelectedItems.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setFormSelectedItems((prev) => {
                          const next = new Set(prev);
                          selected ? next.delete(item.id) : next.add(item.id);
                          return next;
                        });
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        selected
                          ? 'bg-purple-500/12 border-purple-500/35 shadow-[0_0_12px_#a855f715]'
                          : 'bg-black/40 border-[rgba(212,175,55,0.1)] hover:border-[#2a3f55]'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        selected ? 'bg-purple-500 border-purple-500' : 'border-[#2a3f55]'
                      }`}>
                        {selected && <CheckCircle2 size={12} className="text-white" />}
                      </div>

                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                        : <div className="w-9 h-9 rounded-lg bg-[#1e2d3d] flex items-center justify-center shrink-0">
                            <Package size={16} className="text-gray-600" />
                          </div>
                      }
                      <div className="min-w-0">
                        <div className={`text-sm font-bold truncate ${selected ? 'text-white' : 'text-gray-300'}`}>
                          {item.name}
                        </div>
                        <div className="text-[10px] text-gray-600 flex items-center gap-1.5">
                          <span>Expired {item.expires_at ? new Date(item.expires_at).toLocaleDateString() : ''}</span>
                          <span className="text-gray-700">·</span>
                          <span className={selected ? 'text-purple-400 font-bold' : 'text-gray-500'}>
                            {Math.max(1, item.current_stock)} unit{Math.max(1, item.current_stock) !== 1 ? 's' : ''} = {Math.max(1, item.current_stock)} prize slot{Math.max(1, item.current_stock) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary preview */}
          {formTitle && formSelectedItems.size > 0 && (
            <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/15 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Prizes</span>
                <span className="text-white font-bold">
                  {queuedItems.filter((i) => formSelectedItems.has(i.id)).reduce((sum, i) => sum + Math.max(1, i.current_stock), 0)} slots
                  <span className="text-gray-600 font-normal ml-1">
                    ({formSelectedItems.size} item type{formSelectedItems.size > 1 ? 's' : ''})
                  </span>
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Winners to draw</span>
                <span className="text-purple-400 font-bold">
                  {queuedItems.filter((i) => formSelectedItems.has(i.id)).reduce((sum, i) => sum + Math.max(1, i.current_stock), 0)}
                  <span className="text-gray-600 font-normal ml-1">(one per prize slot)</span>
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Ticket price</span>
                <span className="text-purple-400 font-bold">{parseInt(formTicketPrice) || 0} DKP each</span>
              </div>
              {formRequiredEvent && (
                <div className="flex justify-between text-gray-400">
                  <span>Attendance required</span>
                  <span className="text-purple-400 font-bold">{formRequiredEvent}</span>
                </div>
              )}
              {formDrawAt && (
                <div className="flex justify-between text-gray-400">
                  <span>Draw date</span>
                  <span className="text-white font-bold">{new Date(formDrawAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button onClick={() => { setShowCreateForm(false); setFormSelectedItems(new Set()); setFormRequiredEvent(''); }}
              disabled={formSaving}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={formSaving || formSelectedItems.size === 0}
              className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {formSaving ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
              Create Raffle
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && raffles.length === 0 && (
        <div className="card p-16 text-center">
          <Ticket size={48} className="mx-auto text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">No raffles yet</p>
          {isAdmin && (
            <p className="text-gray-600 text-sm mt-1">
              {queuedItems.length > 0
                ? `${queuedItems.length} expired item${queuedItems.length > 1 ? 's' : ''} waiting — create a raffle above`
                : 'Expired shop items will appear here for raffle'}
            </p>
          )}
        </div>
      )}

      {/* ── Open Raffles ── */}
      {openRaffles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">
              Live — {openRaffles.length}
            </span>
          </div>

          <div className="space-y-5">
            {openRaffles.map((raffle) => {
              const isExpanded  = expandedRaffle === raffle.id;
              const rafflePrizes   = prizes[raffle.id] || [];
              const raffleEntries  = entries[raffle.id] || [];
              const isBuying    = buyingId === raffle.id;
              const myTicketCount  = myTickets(raffle.id);
              const chance      = winChance(raffle, raffle.id);
              const soldPct     = raffle.max_tickets
                ? Math.round((raffle.tickets_sold / raffle.max_tickets) * 100) : null;
              const isFull      = raffle.max_tickets !== null && raffle.tickets_sold >= raffle.max_tickets;

              // Eligibility check
              const isGated = !!raffle.required_event_name;
              const isEligible = !isGated ||
                isAdmin ||
                myAttendedEvents.has((raffle.required_event_name || '').toLowerCase());

              return (
                <div key={raffle.id} className="card overflow-hidden border-purple-500/15">
                  <div className="p-5 space-y-4">

                    {/* Title + draw date */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black tracking-tight">{raffle.title}</h3>
                        {raffle.description && (
                          <p className="text-gray-500 text-xs mt-0.5">{raffle.description}</p>
                        )}
                      </div>
                      {raffle.draw_at && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-[rgba(212,175,55,0.1)] text-xs text-gray-400 shrink-0">
                          <Clock size={11} />
                          {new Date(raffle.draw_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Prizes list */}
                    {rafflePrizes.length > 0 && (
                      <div>
                        <div className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mb-2">
                          {rafflePrizes.length} Prize{rafflePrizes.length !== 1 ? 's' : ''} · {raffle.winner_count} Winner{raffle.winner_count !== 1 ? 's' : ''} will be drawn
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {rafflePrizes.map((prize) => (
                            <div key={prize.id}
                              className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-[rgba(212,175,55,0.1)]">
                              {prize.item_image
                                ? <img src={prize.item_image} alt={prize.item_name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                                : <div className="w-8 h-8 rounded-lg bg-[#1e2d3d] flex items-center justify-center shrink-0">
                                    <Gift size={14} className="text-purple-400" />
                                  </div>
                              }
                              <span className="text-xs text-gray-300 truncate font-medium">{prize.item_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 rounded-xl bg-black/40 border border-[rgba(212,175,55,0.1)] text-center">
                        <div className="text-lg font-black text-purple-400 hud-number">{raffle.ticket_price}</div>
                        <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-0.5">DKP/ticket</div>
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-[rgba(212,175,55,0.1)] text-center">
                        <div className="text-lg font-black text-white hud-number">
                          {raffle.tickets_sold}
                          {raffle.max_tickets && <span className="text-gray-600 text-sm font-normal">/{raffle.max_tickets}</span>}
                        </div>
                        <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-0.5">Sold</div>
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-[rgba(212,175,55,0.1)] text-center">
                        <div className="text-lg font-black text-[#D4AF37] hud-number">{myTicketCount}</div>
                        <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-0.5">Yours</div>
                      </div>
                    </div>

                    {/* Stock bar */}
                    {soldPct !== null && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Tickets sold</span>
                          <span className={soldPct >= 90 ? 'text-red-400' : soldPct >= 60 ? 'text-yellow-400' : 'text-purple-400'}>
                            {soldPct}%
                          </span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{
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
                        {raffle.winner_count > 1 && (
                          <span className="text-purple-600 ml-1">({raffle.winner_count} prizes up for grabs)</span>
                        )}
                      </div>
                    )}

                    {/* Attendance requirement banner */}
                    {isGated && (
                      <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs ${
                        isEligible
                          ? 'bg-green-500/8 border-green-500/20 text-green-300'
                          : 'bg-red-500/8 border-red-500/20 text-red-300'
                      }`}>
                        {isEligible
                          ? <ShieldCheck size={14} className="text-green-400 shrink-0" />
                          : <Lock size={14} className="text-red-400 shrink-0" />}
                        <div>
                          <span className="font-bold">
                            {isEligible ? 'You are eligible' : 'Attendance required'}
                          </span>
                          <span className="text-gray-500 ml-1">
                            — must have attended
                            <span className={`font-bold mx-1 ${isEligible ? 'text-green-400' : 'text-red-400'}`}>
                              "{raffle.required_event_name}"
                            </span>
                            {!isEligible && '(you have not attended this event)'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Ticket input */}
                    {!isFull && !isEligible ? (
                      <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/8 border border-red-500/15 text-red-400 text-sm font-bold">
                        <Lock size={14} /> You cannot enter this raffle
                      </div>
                    ) : !isFull ? (
                      <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-black/60 border border-[rgba(212,175,55,0.1)] rounded-xl px-3 focus-within:border-purple-500/50 transition-colors">
                          <Ticket size={14} className="text-purple-400 shrink-0" />
                          <input
                            type="number" min="1"
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
                          {isBuying ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
                          Enter
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/8 border border-red-500/15 text-red-400 text-sm font-bold">
                        Tickets sold out
                      </div>
                    )}

                    {/* Entries + admin actions */}
                    <div className="flex items-center justify-between pt-1">
                      <button onClick={() => toggleExpand(raffle.id)}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        <Users size={12} />
                        {raffle.tickets_sold} ticket{raffle.tickets_sold !== 1 ? 's' : ''} · view entries
                      </button>

                      {isAdmin && (
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleDraw(raffle)}
                            disabled={drawingId === raffle.id || raffle.tickets_sold === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 text-xs font-bold disabled:opacity-40"
                          >
                            {drawingId === raffle.id ? <Loader2 size={12} className="animate-spin" /> : <Shuffle size={12} />}
                            Draw {raffle.winner_count} Winner{raffle.winner_count > 1 ? 's' : ''}
                          </button>
                          <button
                            onClick={() => setCancelConfirm(raffle.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-500/8 text-yellow-500/70 hover:text-yellow-400 hover:bg-yellow-500/15 border border-yellow-500/10 text-xs font-bold transition-all"
                          >
                            <AlertTriangle size={12} />
                            Cancel & Refund
                          </button>
                          <button onClick={() => setDeleteConfirm(raffle.id)}
                            className="p-1.5 rounded-xl bg-red-500/8 text-red-500/60 hover:text-red-400 hover:bg-red-500/15 border border-red-500/10 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expanded entries */}
                    {isExpanded && (
                      <div className="border-t border-[rgba(212,175,55,0.1)] pt-3 animate-fade-in space-y-1.5">
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
                                    : 'bg-[rgba(0,0,0,0.35)] border-[rgba(212,175,55,0.1)]'
                                }`}>
                                <span className={entry.member_id === myId ? 'text-purple-300 font-bold' : 'text-gray-300'}>
                                  {entry.member_name}
                                  {entry.member_id === myId && <span className="text-purple-600 ml-1">(you)</span>}
                                </span>
                                <div className="flex items-center gap-3">
                                  <span className="text-purple-400 font-black">{entry.tickets}x</span>
                                  <span className="text-gray-600">{entry.total_cost} DKP</span>
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

      {/* ── Completed Raffles ── */}
      {closedRaffles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-gray-600" />
            <span className="text-xs font-black uppercase tracking-widest text-gray-600">
              Ended — {closedRaffles.length}
            </span>
          </div>
          <div className="space-y-4">
            {closedRaffles.map((raffle) => {
              const rafflePrizes = prizes[raffle.id] || [];
              const isExpanded   = expandedRaffle === raffle.id;

              // ── Group prizes by winner, sort by item count desc ──
              const winnerMap = new Map<string, {
                name: string;
                items: { item_name: string; count: number; image: string | null }[];
                total: number;
              }>();

              rafflePrizes
                .filter((p) => p.winner_name)
                .forEach((p) => {
                  const existing = winnerMap.get(p.winner_name!);
                  if (existing) {
                    const itemEntry = existing.items.find((i) => i.item_name === p.item_name);
                    if (itemEntry) {
                      itemEntry.count++;
                    } else {
                      existing.items.push({ item_name: p.item_name, count: 1, image: p.item_image });
                    }
                    existing.total++;
                  } else {
                    winnerMap.set(p.winner_name!, {
                      name:  p.winner_name!,
                      items: [{ item_name: p.item_name, count: 1, image: p.item_image }],
                      total: 1,
                    });
                  }
                });

              // Sort winners by total items won desc, then sort items within each winner desc
              const winners = Array.from(winnerMap.values())
                .map((w) => ({
                  ...w,
                  items: w.items.sort((a, b) => b.count - a.count),
                }))
                .sort((a, b) => b.total - a.total);

              return (
                <div key={raffle.id} className="card overflow-hidden opacity-80 hover:opacity-95 transition-opacity">
                  {/* ── Raffle header ── */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
                    onClick={() => toggleExpand(raffle.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        raffle.status === 'completed'
                          ? 'bg-yellow-500/15 border border-yellow-500/25'
                          : 'bg-red-500/10 border border-red-500/20'
                      }`}>
                        {raffle.status === 'completed'
                          ? <Trophy size={14} className="text-yellow-400" />
                          : <AlertTriangle size={14} className="text-red-400" />}
                      </div>
                      <div>
                        <h3 className="font-black text-sm">{raffle.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-black uppercase ${
                            raffle.status === 'completed' ? 'text-green-500' : 'text-red-500'
                          }`}>{raffle.status}</span>
                          {raffle.status === 'completed' && winners.length > 0 && (
                            <>
                              <span className="text-gray-700 text-[10px]">·</span>
                              <span className="text-[10px] text-gray-500">
                                {winners.length} winner{winners.length !== 1 ? 's' : ''}
                              </span>
                              <span className="text-gray-700 text-[10px]">·</span>
                              <span className="text-[10px] text-gray-500">
                                {rafflePrizes.filter((p) => p.winner_name).length} prize{rafflePrizes.filter((p) => p.winner_name).length !== 1 ? 's' : ''} awarded
                              </span>
                            </>
                          )}
                          {raffle.completed_at && (
                            <>
                              <span className="text-gray-700 text-[10px]">·</span>
                              <span className="text-[10px] text-gray-600">
                                {new Date(raffle.completed_at).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(raffle.id); }}
                          className="p-1.5 text-gray-700 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <div className="text-gray-600">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* ── Winner profiles (expanded) ── */}
                  {isExpanded && (
                    <div className="border-t border-[rgba(212,175,55,0.1)] bg-[#060a10] px-4 py-4 animate-fade-in">
                      {raffle.status === 'cancelled' ? (
                        <div className="text-center py-6">
                          <AlertTriangle size={24} className="mx-auto text-red-400/50 mb-2" />
                          <p className="text-gray-500 text-sm">Raffle was cancelled — all DKP refunded</p>
                        </div>
                      ) : winners.length === 0 ? (
                        <div className="text-center py-6">
                          <Trophy size={24} className="mx-auto text-gray-700 mb-2" />
                          <p className="text-gray-500 text-sm">No winners were drawn</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-xs text-gray-600 uppercase tracking-wider font-bold mb-3">
                            🏆 Winners
                          </div>

                          {winners.map((winner, wi) => (
                            <div
                              key={winner.name}
                              className={`rounded-xl border overflow-hidden ${
                                wi === 0
                                  ? 'border-yellow-500/30 shadow-[0_0_16px_#f59e0b10]'
                                  : wi === 1
                                  ? 'border-gray-400/20'
                                  : wi === 2
                                  ? 'border-orange-500/20'
                                  : 'border-[rgba(212,175,55,0.1)]'
                              }`}
                            >
                              {/* Winner header */}
                              <div className={`flex items-center gap-3 px-4 py-3 ${
                                wi === 0 ? 'bg-yellow-500/8' : 'bg-[rgba(0,0,0,0.35)]'
                              }`}>
                                {/* Rank badge */}
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                  wi === 0 ? 'bg-yellow-400/20 text-yellow-400' :
                                  wi === 1 ? 'bg-gray-300/20 text-gray-300' :
                                  wi === 2 ? 'bg-orange-400/20 text-orange-400' :
                                  'bg-white/5 text-gray-500'
                                }`}>
                                  #{wi + 1}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className={`font-black text-sm ${
                                    wi === 0 ? 'text-yellow-400 text-glow-gold' :
                                    wi === 1 ? 'text-gray-200' :
                                    wi === 2 ? 'text-orange-400' : 'text-white'
                                  }`}>
                                    {winner.name}
                                    {winner.name === (currentUser?.member.username || '') && (
                                      <span className="text-[10px] font-normal text-[rgba(212,175,55,0.6)] ml-2">(you)</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    Won {winner.total} prize{winner.total !== 1 ? 's' : ''}
                                    {winner.items.length < winner.total && (
                                      <span className="text-gray-600 ml-1">
                                        ({winner.items.length} item type{winner.items.length !== 1 ? 's' : ''})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {wi === 0 && (
                                  <Crown size={16} className="text-yellow-400 shrink-0" />
                                )}
                              </div>

                              {/* Items won */}
                              <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {winner.items.map((item) => (
                                  <div
                                    key={item.item_name}
                                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/40 border border-[rgba(212,175,55,0.1)]"
                                  >
                                    {item.image ? (
                                      <img
                                        src={item.image}
                                        alt={item.item_name}
                                        className="w-9 h-9 rounded-lg object-cover shrink-0 border border-[rgba(212,175,55,0.1)]"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-lg bg-[#1e2d3d] flex items-center justify-center shrink-0">
                                        <Gift size={16} className="text-gray-600" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-bold text-gray-200 truncate">
                                        {item.item_name}
                                      </div>
                                      {item.count > 1 && (
                                        <div className="text-[10px] text-purple-400 font-bold mt-0.5">
                                          ×{item.count} (won {item.count} of this item)
                                        </div>
                                      )}
                                    </div>
                                    {item.count > 1 && (
                                      <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                                        <span className="text-[10px] font-black text-purple-400">{item.count}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
