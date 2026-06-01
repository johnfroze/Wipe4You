import { useState, useEffect, useRef, useCallback } from 'react';
import {
  supabase, getAuctions, createAuction,
  updateAuction, deleteAuction, uploadAuctionImage,
} from '@/lib/supabase';
import type { CurrentUser, Member, Auction } from '@/types';
import {
  Gavel, Plus, Trash2, Timer, TrendingUp, X,
  AlertTriangle, CheckCircle2, Package, Clock,
  ChevronUp, Loader2, Zap,
} from 'lucide-react';

interface Props {
  currentUser: CurrentUser | null;
  members: Member[];
  onMembersChange: () => void;
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

export function AuctionsPage({ currentUser, members, onMembersChange }: Props) {
  const isAdmin = currentUser?.member.role === 'leader' || currentUser?.member.role === 'elder';

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [bidInputs, setBidInputs] = useState<Record<number, string>>({});
  const [now, setNow] = useState(Date.now());
  const [bidLoading, setBidLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Set<number>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(new Set<number>());
  const auctionsRef = useRef(auctions);
  const membersRef = useRef(members);
  const onMembersChangeRef = useRef(onMembersChange);
  auctionsRef.current = auctions;
  membersRef.current = members;
  onMembersChangeRef.current = onMembersChange;

  // Form
  const [itemName, setItemName] = useState('');
  const [startBid, setStartBid] = useState('');
  const [increment, setIncrement] = useState('1');
  const [minutes, setMinutes] = useState('60');
  const [uploading, setUploading] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAuctions = useCallback(async () => {
    const data = await getAuctions();
    setAuctions(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAuctions();
    const channel = supabase
      .channel('auction-realtime-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, async () => {
        const data = await getAuctions();
        if (!cancelled) setAuctions(data);
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [loadAuctions]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-end auctions
  useEffect(() => {
    const checkEnded = async () => {
      for (const a of auctionsRef.current) {
        if (a.ended || processingRef.current.has(a.id) || Date.now() < a.end_time) continue;
        processingRef.current.add(a.id);
        try {
          await supabase.from('auctions').update({ ended: true }).eq('id', a.id);
          if (a.highest_bidder && a.highest_bidder !== 'None') {
            const winner = membersRef.current.find((m) => m.username === a.highest_bidder);
            if (winner) {
              await supabase.from('members').update({ dkp: Math.max(0, winner.dkp - a.current_bid) }).eq('id', winner.id);
              onMembersChangeRef.current();
            }
          }
          await loadAuctions();
        } catch (err) {
          console.error(err);
        } finally {
          processingRef.current.delete(a.id);
        }
      }
    };
    checkEnded();
  }, [now, loadAuctions]);

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
      await createAuction({ item, image: image || null, current_bid: bid, increment: inc, end_time: Date.now() + mins * 60000 });
      setShowModal(false);
      setItemName(''); setStartBid(''); setIncrement('1'); setMinutes('60');
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast(`Auction "${item}" created`, 'success');
      await loadAuctions();
    } catch { showToast('Failed to create auction', 'error'); }
  };

  const placeBid = async (auctionId: number) => {
    if (!currentUser?.member) { showToast('You must be logged in', 'error'); return; }
    const auction = auctions.find((a) => a.id === auctionId);
    if (!auction || auction.ended) { showToast('Auction has ended', 'error'); return; }
    const bid = parseInt(bidInputs[auctionId] || '');
    if (isNaN(bid)) { showToast('Enter a valid bid amount', 'error'); return; }
    const minimum = auction.current_bid + auction.increment;
    if (bid < minimum) { showToast(`Minimum bid is ${minimum} DKP`, 'error'); return; }
    if (currentUser.member.dkp < bid) { showToast('Not enough DKP', 'error'); return; }

    let newEndTime = auction.end_time;
    if (auction.end_time - Date.now() < 30000) newEndTime += 30000;

    const newHistory = [
      { user: currentUser.member.username, bid, timestamp: new Date().toISOString() },
      ...auction.history,
    ];

    setBidLoading(auctionId);
    try {
      await updateAuction(auctionId, { current_bid: bid, highest_bidder: currentUser.member.username, history: newHistory, end_time: newEndTime });
      setBidInputs((prev) => ({ ...prev, [auctionId]: '' }));
      showToast(`Bid of ${bid} DKP placed!`, 'success');
    } catch { showToast('Bid failed — try again', 'error'); }
    finally { setBidLoading(null); }
  };

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

  const removeBidHistory = async (auctionId: number, index: number) => {
    const auction = auctions.find((a) => a.id === auctionId);
    if (!auction) return;
    try {
      await updateAuction(auctionId, { history: auction.history.filter((_, i) => i !== index) });
      await loadAuctions();
    } catch { showToast('Failed to remove bid', 'error'); }
  };

  const getRemaining = (endTime: number) => Math.max(0, endTime - now);

  const formatTime = (ms: number) => {
    if (ms <= 0) return 'Ended';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
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

  const activeAuctions = auctions.filter((a) => !a.ended && now < a.end_time);
  const endedAuctions = auctions.filter((a) => a.ended || now >= a.end_time);

  return (
    <div className="animate-fade-in space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmDelete !== null && (
        <ConfirmModal
          title="Delete Auction"
          message="This will permanently remove the auction and its bid history."
          confirmLabel="Delete"
          onConfirm={handleDeleteAuction}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteLoading}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2.5 tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
              <Gavel size={16} className="text-cyan-400" />
            </div>
            Auctions
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeAuctions.length} active · {endedAuctions.length} ended
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Create Auction
          </button>
        )}
      </div>

      {/* No auctions */}
      {auctions.length === 0 && (
        <div className="card p-16 text-center">
          <Gavel size={48} className="mx-auto text-gray-700 mb-4" />
          <p className="text-gray-500 font-medium">No auctions yet</p>
          {isAdmin && <p className="text-gray-600 text-sm mt-1">Create the first auction above</p>}
        </div>
      )}

      {/* Active auctions */}
      {activeAuctions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Live</span>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {activeAuctions.map((a) => {
              const remaining = getRemaining(a.end_time);
              const isHistoryExpanded = expandedHistory.has(a.id);
              const minBid = a.current_bid + a.increment;

              return (
                <div key={a.id} className="card overflow-hidden animate-border-pulse">
                  {a.image && (
                    <div className="h-52 bg-black overflow-hidden">
                      <img src={a.image} alt={a.item} className="w-full h-full object-contain" />
                    </div>
                  )}

                  <div className="p-5">
                    {/* Top */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-black tracking-tight">{a.item}</h3>
                        <p className="text-gray-600 text-xs mt-0.5">Min increment: +{a.increment} DKP</p>
                      </div>
                      <div className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl bg-black/40 border border-[#1e2d3d] ${getTimerClass(remaining)}`}>
                        <Timer size={13} />
                        {formatTime(remaining)}
                      </div>
                    </div>

                    {/* Bid */}
                    <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-black/40 border border-[#1e2d3d]">
                      <div>
                        <div className="text-xs text-gray-500 mb-0.5">Current Bid</div>
                        <div className="text-2xl font-black text-cyan-400 hud-number tabular-nums text-glow-cyan">
                          {a.current_bid.toLocaleString()} DKP
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-0.5">Highest Bidder</div>
                        <div className="text-sm font-bold text-white">{a.highest_bidder || 'None'}</div>
                      </div>
                    </div>

                    {/* History toggle */}
                    {a.history.length > 0 && (
                      <div className="mb-4">
                        <button
                          onClick={() => toggleHistory(a.id)}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2"
                        >
                          {isHistoryExpanded ? <ChevronUp size={13} /> : <TrendingUp size={13} />}
                          {a.history.length} bid{a.history.length !== 1 ? 's' : ''} history
                        </button>
                        {isHistoryExpanded && (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto animate-fade-in">
                            {a.history.map((h, i) => (
                              <div key={i} className="flex items-center justify-between bg-black/40 border border-[#1e2d3d] rounded-lg px-3 py-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <TrendingUp size={11} className="text-cyan-400" />
                                  <span className="text-gray-300">{h.user}</span>
                                  <span className="text-cyan-400 font-bold tabular-nums">{h.bid.toLocaleString()} DKP</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-600 text-[10px]">
                                    {new Date(h.timestamp).toLocaleTimeString()}
                                  </span>
                                  {isAdmin && (
                                    <button onClick={() => removeBidHistory(a.id, i)} className="text-red-500/60 hover:text-red-400">
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bid input */}
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={bidInputs[a.id] || ''}
                        onChange={(e) => setBidInputs((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && placeBid(a.id)}
                        placeholder={`Min ${minBid.toLocaleString()} DKP`}
                        className="flex-1 bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm focus:border-cyan-500/50 focus:outline-none"
                      />
                      <button
                        onClick={() => placeBid(a.id)}
                        disabled={bidLoading === a.id}
                        className="btn-primary flex items-center gap-2 disabled:opacity-50"
                      >
                        {bidLoading === a.id ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                        Bid
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ended auctions */}
      {endedAuctions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-gray-600" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-600">Ended</span>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {endedAuctions.map((a) => (
              <div key={a.id} className="card opacity-70 overflow-hidden">
                {a.image && (
                  <div className="h-40 bg-black overflow-hidden grayscale">
                    <img src={a.image} alt={a.item} className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-black text-base">{a.item}</h3>
                    <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-[10px] font-black uppercase border border-red-500/20">
                      Ended
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-[#1e2d3d] mb-3">
                    <div>
                      <div className="text-[10px] text-gray-600 mb-0.5">Final Bid</div>
                      <div className="text-lg font-black text-gray-400 hud-number">{a.current_bid.toLocaleString()} DKP</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-600 mb-0.5">Winner</div>
                      <div className="text-sm font-bold text-gray-300">{a.highest_bidder || 'No bids'}</div>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setConfirmDelete(a.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/8 text-red-500/80 hover:bg-red-500/15 border border-red-500/15 text-xs font-bold uppercase tracking-wide transition-all"
                    >
                      <Trash2 size={13} /> Delete Auction
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d1117] rounded-2xl p-6 w-full max-w-lg border border-[#1e2d3d] animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black flex items-center gap-2">
                <Gavel size={20} className="text-cyan-400" /> Create Auction
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-600 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { value: itemName, set: setItemName, placeholder: 'Item name', type: 'text' },
                { value: startBid, set: setStartBid, placeholder: 'Starting bid (DKP)', type: 'number' },
                { value: increment, set: setIncrement, placeholder: 'Minimum increment (DKP)', type: 'number' },
                { value: minutes, set: setMinutes, placeholder: 'Duration (minutes)', type: 'number' },
              ].map((f) => (
                <input
                  key={f.placeholder}
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  type={f.type}
                  placeholder={f.placeholder}
                  className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm focus:border-cyan-500/50 focus:outline-none"
                />
              ))}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm text-gray-500"
              />
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-300 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateAuction} disabled={uploading}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : <><Gavel size={14} /> Create Auction</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
