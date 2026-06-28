import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  supabase, getAuctions, createAuction,
  updateAuction, deleteAuction, uploadAuctionImage,
  endAuctionAtomic, placeBid as placeBidRpc, getDistinctEventNames,
} from '@/lib/supabase';
import type { CurrentUser, Member, Auction } from '@/types';
import {
  Gavel, Plus, Trash2, Timer, TrendingUp, X,
  AlertTriangle, CheckCircle2, ChevronUp, ChevronDown,
  Loader2, Zap, Trophy, Users, Clock,
  TimerReset, Eye, EyeOff, ShieldCheck, Lock, CalendarClock,
} from 'lucide-react';

interface Props {
  currentUser: CurrentUser | null;
  members: Member[];
  onMembersChange: () => void;
}

// ─── Toast ────────────────────────────────────────────────
function Toast({ message, type, onClose }: {
  message: string; type: 'success' | 'error' | 'warning'; onClose: () => void;
}) {
  const styles = {
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    error:   'bg-red-500/10 text-red-400 border-red-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  };
  const icons = {
    success: <CheckCircle2 size={15} />,
    error:   <AlertTriangle size={15} />,
    warning: <AlertTriangle size={15} />,
  };
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-slide-in-right border ${styles[type]}`}>
      {icons[type]}{message}
      <button onClick={onClose} className="ml-1 hover:text-white"><X size={13} /></button>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel, loading = false }: {
  title: string; message: string; confirmLabel: string; confirmClass?: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0d1117] border border-[#1e2d3d] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-fade-in">
        <h3 className="font-bold text-base">{title}</h3>
        <p className="text-sm text-gray-400">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-50 transition-colors ${confirmClass || 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'}`}>
            {loading && <Loader2 size={13} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Outbid Banner ────────────────────────────────────────
function OutbidBanner({ username, auction }: { username: string; auction: Auction }) {
  const myBids = auction.history.filter((h) => h.user === username);
  if (myBids.length === 0) return null;
  const isWinning = auction.highest_bidder === username;
  if (isWinning) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/8 border border-green-500/20 text-green-400 text-xs font-bold">
        <CheckCircle2 size={13} /> You are winning this auction!
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-bold animate-pulse">
      <AlertTriangle size={13} /> You've been outbid! — {auction.highest_bidder} is now leading
    </div>
  );
}

// ─── Quick Bid Buttons ────────────────────────────────────
function QuickBidButtons({ minBid, currentInput, onSelect }: {
  minBid: number; currentInput: string; onSelect: (val: string) => void;
}) {
  const presets = [
    { label: 'Min', value: minBid },
    { label: `+${minBid + 50}`, value: minBid + 50 },
    { label: `+${minBid + 100}`, value: minBid + 100 },
    { label: `+${minBid + 250}`, value: minBid + 250 },
  ];
  return (
    <div className="flex gap-1.5 flex-wrap mb-2">
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={() => onSelect(String(p.value))}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
            currentInput === String(p.value)
              ? 'bg-[rgba(212,175,55,0.12)] border-[rgba(212,175,55,0.4)] text-[#D4AF37]'
              : 'bg-black/40 border-[#1e2d3d] text-gray-500 hover:text-gray-200 hover:border-[#2a3f55]'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ─── Auction Stats ────────────────────────────────────────
function AuctionStats({ auction }: { auction: Auction }) {
  const uniqueBidders = new Set(auction.history.map((h) => h.user)).size;
  return (
    <div className="flex items-center gap-4 text-[11px] text-gray-600 border-t border-[#1a2234] pt-3 mt-3">
      <span className="flex items-center gap-1">
        <TrendingUp size={10} /> {auction.history.length} bid{auction.history.length !== 1 ? 's' : ''}
      </span>
      <span className="flex items-center gap-1">
        <Users size={10} /> {uniqueBidders} bidder{uniqueBidders !== 1 ? 's' : ''}
      </span>
      {auction.created_at && (
        <span className="flex items-center gap-1 ml-auto">
          <Clock size={10} /> Started {new Date(auction.created_at).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

// ─── Winner Card ──────────────────────────────────────────
function WinnerCard({ auction }: { auction: Auction }) {
  const hasWinner = auction.highest_bidder && auction.highest_bidder !== 'None';
  if (!hasWinner) {
    return (
      <div className="p-3 rounded-xl bg-black/40 border border-[#1e2d3d] text-center">
        <p className="text-gray-500 text-sm">No bids were placed</p>
      </div>
    );
  }
  return (
    <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/8 to-orange-500/8 border border-yellow-500/20">
      <div className="flex items-center gap-2 mb-2">
        <Trophy size={16} className="text-yellow-400" />
        <span className="text-yellow-400 text-xs font-black uppercase tracking-wider">Auction Won</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Winner</div>
          <div className="font-black text-white">{auction.highest_bidder}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 mb-0.5">Final Price</div>
          <div className="font-black text-yellow-400 hud-number tabular-nums">
            {auction.current_bid.toLocaleString()} DKP
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
export function AuctionsPage({ currentUser, members, onMembersChange }: Props) {
  const isAdmin = currentUser?.member.role === 'leader' || currentUser?.member.role === 'elder';
  const myUsername = currentUser?.member.username || '';

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [bidInputs, setBidInputs] = useState<Record<number, string>>({});
  const [now, setNow] = useState(Date.now());
  const [bidLoading, setBidLoading] = useState<number | null>(null);
  const [extendLoading, setExtendLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Set<number>>(new Set());
  const [showEndedAuctions, setShowEndedAuctions] = useState(true);

  // Track which auctions had anti-snipe triggered this session
  const [antiSnipeTriggered, setAntiSnipeTriggered] = useState<Set<number>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(new Set<number>());
  const auctionsRef = useRef(auctions);
  const membersRef = useRef(members);
  const onMembersChangeRef = useRef(onMembersChange);
  auctionsRef.current = auctions;
  membersRef.current = members;
  onMembersChangeRef.current = onMembersChange;

  // Form state
  const [itemName, setItemName] = useState('');
  const [startBid, setStartBid] = useState('');
  const [increment, setIncrement] = useState('1');
  const [minutes, setMinutes] = useState('60');
  const [uploading, setUploading] = useState(false);
  const [requiredEvent, setRequiredEvent] = useState('');
  const [eventNames, setEventNames] = useState<string[]>([]);
  const [myAttendedEvents, setMyAttendedEvents] = useState<Set<string>>(new Set());

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const loadAuctions = useCallback(async () => {
    const data = await getAuctions();
    setAuctions(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAuctions();

    // Load event names for the attendance gate dropdown
    getDistinctEventNames().then((names) => {
      if (!cancelled) setEventNames(names);
    });

    // Load which events the current member attended
    if (currentUser?.member?.id) {
      supabase
        .from('attendance_log')
        .select('event_name')
        .eq('member_id', currentUser.member.id)
        .then(({ data }) => {
          if (data && !cancelled) {
            setMyAttendedEvents(
              new Set(data.map((r: any) => (r.event_name as string).toLowerCase()))
            );
          }
        });
    }

    const channel = supabase
      .channel('auction-realtime-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, async () => {
        const data = await getAuctions();
        if (!cancelled) setAuctions(data);
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [loadAuctions, currentUser]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-end auctions — uses atomic Postgres RPC so multiple
  // open tabs cannot double-charge the winner's DKP
  useEffect(() => {
    const checkEnded = async () => {
      for (const a of auctionsRef.current) {
        if (a.ended || processingRef.current.has(a.id) || Date.now() < a.end_time) continue;
        processingRef.current.add(a.id);
        try {
          const result = await endAuctionAtomic(a.id);
          console.debug(`[end_auction] id=${a.id} result=${result}`);
          if (result === 'ok') {
            onMembersChangeRef.current();
          } else if (result === 'winner_not_found') {
            // Winner's username didn't match any member row
            // This means highest_bidder name doesn't match members.username exactly
            console.error(`[end_auction] winner not found for auction ${a.id} — bidder was "${a.highest_bidder}"`);
          }
          await loadAuctions();
        } catch (err: any) {
          // Most likely the RPC function doesn't exist yet in Supabase.
          // Go to Supabase SQL Editor and run the end_auction function SQL.
          console.error(`[end_auction] RPC failed for auction ${a.id}:`, err?.message || err);
          // Fallback: mark ended in DB so the auction at least closes,
          // but DKP deduction will need to be done manually via Admin panel.
          try {
            await supabase.from('auctions').update({ ended: true }).eq('id', a.id);
            await loadAuctions();
          } catch (fallbackErr) {
            console.error('[end_auction] fallback also failed:', fallbackErr);
          }
        } finally {
          processingRef.current.delete(a.id);
        }
      }
    };
    checkEnded();
  }, [now, loadAuctions]);

  // ── Place Bid ──
  const placeBid = async (auctionId: number) => {
    if (!currentUser?.member) { showToast('You must be logged in', 'error'); return; }
    const auction = auctions.find((a) => a.id === auctionId);
    if (!auction || auction.ended) { showToast('Auction has ended', 'error'); return; }
    const bid = parseInt(bidInputs[auctionId] || '');
    if (isNaN(bid)) { showToast('Enter a valid bid amount', 'error'); return; }
    const minimum = auction.current_bid + auction.increment;
    if (bid < minimum) { showToast(`Minimum bid is ${minimum.toLocaleString()} DKP`, 'error'); return; }
    if (currentUser.member.dkp < bid) {
      showToast(`Not enough DKP (you have ${currentUser.member.dkp.toLocaleString()})`, 'error'); return;
    }

    // Client-side eligibility check (server also checks via RPC)
    if (auction.required_event_name &&
      !isAdmin &&
      !myAttendedEvents.has(auction.required_event_name.toLowerCase())
    ) {
      showToast(`You must have attended "${auction.required_event_name}" to bid`, 'error');
      return;
    }

    // Anti-snipe
    let newEndTime = auction.end_time;
    const remaining = auction.end_time - Date.now();
    if (remaining < 30000) {
      newEndTime = Date.now() + 30000;
      setAntiSnipeTriggered((prev) => new Set(prev).add(auctionId));
      showToast('⚡ Anti-snipe activated — 30 seconds added!', 'warning');
    }

    setBidLoading(auctionId);
    try {
      // Use atomic RPC which enforces attendance gate server-side
      const result = await placeBidRpc(auctionId, currentUser.member.id, bid);
      if (result === 'not_eligible') {
        showToast(`You must have attended "${auction.required_event_name}" to bid`, 'error');
        return;
      }
      if (result === 'bid_too_low') {
        showToast(`Bid too low — minimum is ${minimum.toLocaleString()} DKP`, 'error');
        return;
      }
      if (result === 'auction_ended') {
        showToast('Auction has already ended', 'error');
        return;
      }
      // If RPC not yet deployed, fall back to direct update
      if (result !== 'ok') {
        await updateAuction(auctionId, {
          current_bid: bid,
          highest_bidder: currentUser.member.username,
          history: [
            { user: currentUser.member.username, bid, timestamp: new Date().toISOString() },
            ...auction.history,
          ],
          end_time: newEndTime,
        });
      } else if (newEndTime !== auction.end_time) {
        // Extend time if anti-snipe triggered (RPC doesn't handle this)
        await updateAuction(auctionId, { end_time: newEndTime });
      }
      setBidInputs((prev) => ({ ...prev, [auctionId]: '' }));
      if (remaining >= 30000) showToast(`Bid of ${bid.toLocaleString()} DKP placed!`, 'success');
      await loadAuctions();
    } catch { showToast('Bid failed — try again', 'error'); }
    finally { setBidLoading(null); }
  };

  // ── Extend Time (admin) ──
  const extendTime = async (auctionId: number) => {
    const auction = auctions.find((a) => a.id === auctionId);
    if (!auction) return;
    setExtendLoading(auctionId);
    try {
      await updateAuction(auctionId, { end_time: auction.end_time + 15 * 60000 });
      showToast('+15 minutes added to auction', 'success');
      await loadAuctions();
    } catch { showToast('Failed to extend time', 'error'); }
    finally { setExtendLoading(null); }
  };

  // ── Create Auction ──
  const handleCreateAuction = async () => {
    const item = itemName.trim();
    if (!item) { showToast('Enter an item name', 'error'); return; }
    const bid = parseInt(startBid) || 0;
    const inc = parseInt(increment) || 1;
    const mins = parseInt(minutes) || 60;
    let image = '';
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      try { setUploading(true); image = await uploadAuctionImage(file); }
      catch { showToast('Image upload failed', 'error'); setUploading(false); return; }
      finally { setUploading(false); }
    }
    try {
      await createAuction({ item, image: image || null, current_bid: bid, increment: inc, end_time: Date.now() + mins * 60000, required_event_name: requiredEvent.trim() || null });
      setShowModal(false);
      setItemName(''); setStartBid(''); setIncrement('1'); setMinutes('60'); setRequiredEvent('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast(`Auction "${item}" created`, 'success');
      await loadAuctions();
    } catch { showToast('Failed to create auction', 'error'); }
  };

  // ── Delete Auction ──
  const handleDeleteAuction = async () => {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      await deleteAuction(confirmDelete);
      await loadAuctions();
      showToast('Auction deleted', 'success');
    } catch { showToast('Delete failed', 'error'); }
    finally { setDeleteLoading(false); setConfirmDelete(null); }
  };

  // ── Remove bid from history ──
  const removeBidHistory = async (auctionId: number, index: number) => {
    const auction = auctions.find((a) => a.id === auctionId);
    if (!auction) return;
    try {
      await updateAuction(auctionId, { history: auction.history.filter((_, i) => i !== index) });
      await loadAuctions();
    } catch { showToast('Failed to remove bid', 'error'); }
  };

  // ── Helpers ──
  const getRemaining = (endTime: number) => Math.max(0, endTime - now);

  const formatTime = (ms: number) => {
    if (ms <= 0) return 'Ended';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getTimerClass = (ms: number) => {
    if (ms <= 0) return 'text-gray-500';
    if (ms < 30000) return 'timer-urgent font-black';
    if (ms < 120000) return 'timer-warning font-bold';
    return 'timer-ok';
  };

  const toggleHistory = (id: number) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Computed ──
  const activeAuctions = useMemo(
    () => auctions.filter((a) => !a.ended && now < a.end_time),
    [auctions, now]
  );
  const endedAuctions = useMemo(
    () => auctions.filter((a) => a.ended || now >= a.end_time),
    [auctions, now]
  );

  // Auctions where the current user is participating but not winning
  const myOutbidCount = useMemo(() => {
    return activeAuctions.filter((a) => {
      const hasBid = a.history.some((h) => h.user === myUsername);
      const isWinning = a.highest_bidder === myUsername;
      return hasBid && !isWinning;
    }).length;
  }, [activeAuctions, myUsername]);

  // ─────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmDelete !== null && (
        <ConfirmModal
          title="Delete Auction"
          message="This will permanently remove the auction and all its bid history."
          confirmLabel="Delete"
          onConfirm={handleDeleteAuction}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteLoading}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2.5 tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center">
              <Gavel size={16} className="text-[#D4AF37]" />
            </div>
            Auctions
            {myOutbidCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-black animate-pulse">
                {myOutbidCount} outbid
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeAuctions.length} live · {endedAuctions.length} ended
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Create Auction
          </button>
        )}
      </div>

      {/* ── Empty ── */}
      {auctions.length === 0 && (
        <div className="card p-16 text-center">
          <Gavel size={48} className="mx-auto text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">No auctions running</p>
          {isAdmin && <p className="text-gray-600 text-sm mt-1">Create the first auction to get started</p>}
        </div>
      )}

      {/* ── Active Auctions ── */}
      {activeAuctions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">
              Live — {activeAuctions.length}
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {activeAuctions.map((a) => {
              const remaining = getRemaining(a.end_time);
              const isHistoryExpanded = expandedHistory.has(a.id);
              const minBid = a.current_bid + a.increment;
              const iAmWinning = a.highest_bidder === myUsername;
              const iHaveBid = a.history.some((h) => h.user === myUsername);
              const iAmOutbid = iHaveBid && !iAmWinning;
              // Attendance gate check
              const isGated = !!a.required_event_name;
              const isEligible = !isGated || isAdmin ||
                myAttendedEvents.has((a.required_event_name || '').toLowerCase());
              const wasAntiSnipe = antiSnipeTriggered.has(a.id);

              return (
                <div
                  key={a.id}
                  className={`card overflow-hidden transition-all ${
                    iAmWinning
                      ? 'border-green-500/30 shadow-[0_0_20px_#10b98110]'
                      : iAmOutbid
                      ? 'border-red-500/30 shadow-[0_0_20px_#ef444410]'
                      : 'animate-border-pulse'
                  }`}
                >
                  {/* Item image */}
                  {a.image && (
                    <div className="h-52 bg-black overflow-hidden relative">
                      <img src={a.image} alt={a.item} className="w-full h-full object-contain" />
                      {/* Timer overlay on image */}
                      <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-sm border border-white/10 text-sm font-bold ${getTimerClass(remaining)}`}>
                        <Timer size={13} />
                        {formatTime(remaining)}
                      </div>
                    </div>
                  )}

                  <div className="p-5 space-y-4">
                    {/* Title row */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-black tracking-tight">{a.item}</h3>
                        <p className="text-gray-600 text-xs mt-0.5">
                          Min increment: <span className="text-gray-400">+{a.increment} DKP</span>
                        </p>
                      </div>
                      {/* Timer (only when no image) */}
                      {!a.image && (
                        <div className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl bg-black/40 border border-[#1e2d3d] ${getTimerClass(remaining)}`}>
                          <Timer size={13} />
                          {formatTime(remaining)}
                        </div>
                      )}
                    </div>

                    {/* Anti-snipe notice */}
                    {wasAntiSnipe && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-500/8 border border-yellow-500/20 text-yellow-400 text-xs font-bold">
                        <TimerReset size={13} /> Anti-snipe triggered — timer was extended
                      </div>
                    )}

                    {/* Your status */}
                    <OutbidBanner username={myUsername} auction={a} />

                    {/* Current bid panel */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/50 border border-[#1e2d3d]">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Current Bid</div>
                        <div className={`text-2xl font-black hud-number tabular-nums ${iAmWinning ? 'text-green-400 text-glow-green' : 'text-[#D4AF37] text-glow-cyan'}`}>
                          {a.current_bid.toLocaleString()} DKP
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Leading</div>
                        <div className={`text-sm font-black ${iAmWinning ? 'text-green-400' : 'text-white'}`}>
                          {a.highest_bidder === 'None' ? '—' : a.highest_bidder}
                        </div>
                        {a.highest_bidder === 'None' && (
                          <div className="text-[10px] text-gray-600 mt-0.5">No bids yet</div>
                        )}
                      </div>
                    </div>

                    {/* Attendance gate banner */}
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
                            {isEligible ? 'You are eligible to bid' : 'Attendance required'}
                          </span>
                          <span className="text-gray-500 ml-1">
                            — must have attended
                            <span className={`font-bold mx-1 ${isEligible ? 'text-green-400' : 'text-red-400'}`}>
                              "{a.required_event_name}"
                            </span>
                            {!isEligible && '(you have not attended this event)'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Quick-bid buttons */}
                    {isEligible && (
                    <div>
                      <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Quick Bid</div>
                      <QuickBidButtons
                        minBid={minBid}
                        currentInput={bidInputs[a.id] || ''}
                        onSelect={(val) => setBidInputs((prev) => ({ ...prev, [a.id]: val }))}
                      />
                    </div>
                    )}

                    {/* Custom bid input — locked for ineligible members */}
                    {!isEligible ? (
                      <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/8 border border-red-500/15 text-red-400 text-sm font-bold">
                        <Lock size={14} /> You cannot bid on this auction
                      </div>
                    ) : (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={bidInputs[a.id] || ''}
                        onChange={(e) => setBidInputs((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && placeBid(a.id)}
                        placeholder={`Custom amount (min ${minBid.toLocaleString()})`}
                        className="flex-1 bg-black/60 border border-[#1e2d3d] rounded-xl px-3 py-2.5 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
                      />
                      <button
                        onClick={() => placeBid(a.id)}
                        disabled={bidLoading === a.id}
                        className="btn-primary flex items-center gap-2 disabled:opacity-50 shrink-0"
                      >
                        {bidLoading === a.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Zap size={14} />}
                        Bid
                      </button>
                    </div>
                    )}

                    {/* Admin: extend time */}
                    {isAdmin && (
                      <button
                        onClick={() => extendTime(a.id)}
                        disabled={extendLoading === a.id}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-blue-500/8 text-blue-400/80 hover:bg-blue-500/15 border border-blue-500/15 text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                      >
                        {extendLoading === a.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <TimerReset size={12} />}
                        +15 Min (Admin)
                      </button>
                    )}

                    {/* Bid history toggle */}
                    {a.history.length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleHistory(a.id)}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {isHistoryExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {a.history.length} bid{a.history.length !== 1 ? 's' : ''} — tap to {isHistoryExpanded ? 'hide' : 'view'}
                        </button>

                        {isHistoryExpanded && (
                          <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto animate-fade-in pr-1">
                            {a.history.map((h, i) => (
                              <div key={i}
                                className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs border transition-colors ${
                                  h.user === myUsername
                                    ? 'bg-[rgba(212,175,55,0.04)] border-[rgba(212,175,55,0.2)]'
                                    : 'bg-black/40 border-[#1e2d3d]'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <TrendingUp size={11} className="text-[#D4AF37] shrink-0" />
                                  <span className={h.user === myUsername ? 'text-[#E8D070] font-bold' : 'text-gray-300'}>
                                    {h.user}
                                    {h.user === myUsername && <span className="text-[rgba(212,175,55,0.6)] ml-1">(you)</span>}
                                  </span>
                                  <span className="text-[#D4AF37] font-bold tabular-nums">
                                    {h.bid.toLocaleString()} DKP
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-gray-700 text-[10px]">
                                    {h.timestamp ? new Date(h.timestamp).toLocaleTimeString() : ''}
                                  </span>
                                  {isAdmin && (
                                    <button onClick={() => removeBidHistory(a.id, i)}
                                      className="text-red-500/40 hover:text-red-400 transition-colors">
                                      <X size={11} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <AuctionStats auction={a} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Ended Auctions ── */}
      {endedAuctions.length > 0 && (
        <div>
          <button
            onClick={() => setShowEndedAuctions((v) => !v)}
            className="flex items-center gap-2 mb-4 group"
          >
            <span className="w-2 h-2 rounded-full bg-gray-600" />
            <span className="text-xs font-black uppercase tracking-widest text-gray-600 group-hover:text-gray-400 transition-colors">
              Ended — {endedAuctions.length}
            </span>
            {showEndedAuctions
              ? <EyeOff size={12} className="text-gray-700 group-hover:text-gray-500 transition-colors" />
              : <Eye size={12} className="text-gray-700 group-hover:text-gray-500 transition-colors" />}
          </button>

          {showEndedAuctions && (
            <div className="grid md:grid-cols-2 gap-4">
              {endedAuctions.map((a) => (
                <div key={a.id} className="card opacity-65 overflow-hidden hover:opacity-80 transition-opacity">
                  {a.image && (
                    <div className="h-36 bg-black overflow-hidden grayscale">
                      <img src={a.image} alt={a.item} className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-black text-sm">{a.item}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 text-[10px] font-black uppercase border border-gray-500/15">
                        Ended
                      </span>
                    </div>

                    <WinnerCard auction={a} />

                    <AuctionStats auction={a} />

                    {isAdmin && (
                      <button
                        onClick={() => setConfirmDelete(a.id)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-500/6 text-red-500/60 hover:bg-red-500/12 border border-red-500/12 text-xs font-bold uppercase tracking-wide transition-all"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create Auction Modal ── */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d1117] rounded-2xl p-6 w-full max-w-lg border border-[#1e2d3d] animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black flex items-center gap-2">
                <Gavel size={20} className="text-[#D4AF37]" /> Create Auction
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-600 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Item Name</label>
                <input value={itemName} onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Dragon Sword +8"
                  className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Starting Bid</label>
                  <input value={startBid} onChange={(e) => setStartBid(e.target.value)}
                    type="number" placeholder="0 DKP"
                    className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Min Increment</label>
                  <input value={increment} onChange={(e) => setIncrement(e.target.value)}
                    type="number" placeholder="1 DKP"
                    className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Duration</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {[15, 30, 60, 120, 240].map((m) => (
                    <button key={m} onClick={() => setMinutes(String(m))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        minutes === String(m)
                          ? 'bg-[rgba(212,175,55,0.12)] border-[rgba(212,175,55,0.4)] text-[#D4AF37]'
                          : 'bg-black/40 border-[#1e2d3d] text-gray-500 hover:text-gray-300'
                      }`}>
                      {m >= 60 ? `${m / 60}h` : `${m}m`}
                    </button>
                  ))}
                </div>
                <input value={minutes} onChange={(e) => setMinutes(e.target.value)}
                  type="number" placeholder="Custom minutes"
                  className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Item Image (optional)</label>
                <input ref={fileInputRef} type="file" accept="image/*"
                  className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm text-gray-500" />
              </div>

              {/* Attendance gate */}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 block">
                  <ShieldCheck size={12} className="text-[#D4AF37]" />
                  Attendance Requirement (optional)
                </label>
                <p className="text-[11px] text-gray-600 mb-2">
                  Only members who attended this event can place bids. Leave blank for open bidding.
                </p>
                <div className="flex gap-2">
                  <select
                    value={requiredEvent}
                    onChange={(e) => setRequiredEvent(e.target.value)}
                    className="flex-1 bg-black/60 border border-[#1e2d3d] rounded-xl px-3 py-3 text-sm focus:border-[rgba(212,175,55,0.45)] focus:outline-none appearance-none"
                  >
                    <option value="">— Open to all members —</option>
                    {eventNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  {requiredEvent && (
                    <button type="button" onClick={() => setRequiredEvent('')}
                      className="px-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white text-xs transition-colors">
                      Clear
                    </button>
                  )}
                </div>
                {requiredEvent && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgba(212,175,55,0.06)] border border-[rgba(212,175,55,0.2)] text-xs text-[#D4AF37]">
                    <Lock size={11} />
                    Only attendees of <span className="font-bold text-white mx-1">"{requiredEvent}"</span> can bid
                  </div>
                )}
              </div>

              {/* Preview summary */}
              {itemName && (
                <div className="p-3 rounded-xl bg-[rgba(212,175,55,0.04)] border border-cyan-500/15 text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Item</span><span className="text-white font-bold">{itemName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Starting bid</span><span className="text-[#D4AF37] font-bold">{parseInt(startBid) || 0} DKP</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration</span><span className="text-white font-bold">
                      {parseInt(minutes) >= 60 ? `${Math.floor(parseInt(minutes) / 60)}h ${parseInt(minutes) % 60 > 0 ? `${parseInt(minutes) % 60}m` : ''}` : `${minutes}m`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-300 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateAuction} disabled={uploading}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                {uploading
                  ? <><Loader2 size={14} className="animate-spin" /> Uploading...</>
                  : <><Gavel size={14} /> Create Auction</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
