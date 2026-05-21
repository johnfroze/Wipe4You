import { useState, useEffect, useRef } from 'react';
import {
  supabase,
  getAuctions,
  createAuction,
  updateAuction,
  deleteAuction,
  uploadAuctionImage,
} from '@/lib/supabase';
import type { CurrentUser, Member, Auction } from '@/types';
import { Gavel, Plus, Trash2, Timer, TrendingUp, X } from 'lucide-react';

interface Props {
  currentUser: CurrentUser | null;
  members: Member[];
  onMembersChange: () => void;
}

export function AuctionsPage({ currentUser, members, onMembersChange }: Props) {
  const isAdmin =
    currentUser?.member.role === 'leader' || currentUser?.member.role === 'elder';
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [bidInputs, setBidInputs] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [itemName, setItemName] = useState('');
  const [startBid, setStartBid] = useState('');
  const [increment, setIncrement] = useState('1');
  const [minutes, setMinutes] = useState('60');
  const [uploading, setUploading] = useState(false);

  // Use refs for timer to avoid re-creating the interval on every state change
  const auctionsRef = useRef(auctions);
  const membersRef = useRef(members);
  const onMembersChangeRef = useRef(onMembersChange);

  // Keep refs in sync
  auctionsRef.current = auctions;
  membersRef.current = members;
  onMembersChangeRef.current = onMembersChange;

  // Initial load + realtime
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await getAuctions();
        if (!cancelled) setAuctions(data);
      } catch (err) {
        console.error('Failed to load auctions:', err);
      }
    };

    load();

    const channel = supabase
      .channel('auction-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auctions' },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []); // Empty deps — only run once on mount

  // Timer: checks for ended auctions every second
  // Uses refs for all mutable data — effect runs ONLY once
  useEffect(() => {
    const tick = async () => {
      const now = Date.now();
      const currentAuctions = auctionsRef.current;

      for (const a of currentAuctions) {
        if (a.ended || now < a.end_time) continue;

        // Auction just ended — update in DB
        try {
          await supabase.from('auctions').update({ ended: true }).eq('id', a.id);

          // Deduct DKP from winner
          if (a.highest_bidder && a.highest_bidder !== 'None') {
            const winner = membersRef.current.find(
              (x) => x.username === a.highest_bidder
            );
            if (winner) {
              await supabase
                .from('members')
                .update({ dkp: Math.max(0, winner.dkp - a.current_bid) })
                .eq('id', winner.id);
              onMembersChangeRef.current();
            }
          }

          // Reload to show updated state
          const data = await getAuctions();
          if (!cancelled) setAuctions(data);
        } catch (err) {
          console.error('Auction end processing failed:', err);
        }
      }
    };

    let cancelled = false;
    const interval = setInterval(tick, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []); // Empty deps — NEVER re-run this effect

  const handleCreateAuction = async () => {
    const item = itemName.trim();
    const bid = parseInt(startBid) || 0;
    const inc = parseInt(increment) || 1;
    const mins = parseInt(minutes) || 60;

    if (!item) {
      alert('Enter item name');
      return;
    }

    let image = '';
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      setUploading(true);
      try {
        image = await uploadAuctionImage(file);
      } catch (err) {
        alert('Failed to upload image');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    try {
      await createAuction({
        item,
        image: image || null,
        current_bid: bid,
        increment: inc,
        end_time: Date.now() + mins * 60000,
      });
      setShowModal(false);
      setItemName('');
      setStartBid('');
      setIncrement('1');
      setMinutes('60');
      if (fileInputRef.current) fileInputRef.current.value = '';

      const data = await getAuctions();
      setAuctions(data);
    } catch (err) {
      alert('Failed to create auction');
    }
  };

  const placeBid = async (auctionId: number) => {
    if (!currentUser?.member) {
      alert('Login to bid');
      return;
    }

    const a = auctions.find((x) => x.id === auctionId);
    if (!a || a.ended) {
      alert('Auction Ended');
      return;
    }

    const bid = parseInt(bidInputs[auctionId] || '');
    if (isNaN(bid)) return;

    const minimum = a.current_bid + a.increment;
    if (bid < minimum) {
      alert(`Minimum bid is ${minimum} DKP`);
      return;
    }

    if (currentUser.member.dkp < bid) {
      alert('Not enough DKP');
      return;
    }

    // Anti-snipe: add 30s if under 30s remaining
    let newEndTime = a.end_time;
    const remaining = a.end_time - Date.now();
    if (remaining < 30000) {
      newEndTime += 30000;
    }

    const newHistory = [
      {
        user: currentUser.member.username,
        bid,
        timestamp: new Date().toISOString(),
      },
      ...a.history,
    ];

    try {
      await updateAuction(auctionId, {
        current_bid: bid,
        highest_bidder: currentUser.member.username,
        history: newHistory,
        end_time: newEndTime,
      });
      setBidInputs((prev) => ({ ...prev, [auctionId]: '' }));

      const data = await getAuctions();
      setAuctions(data);
    } catch (err) {
      alert('Failed to place bid');
    }
  };

  const handleDeleteAuction = async (id: number) => {
    if (!confirm('Delete this auction?')) return;
    try {
      await deleteAuction(id);
      const data = await getAuctions();
      setAuctions(data);
    } catch (err) {
      alert('Failed to delete auction');
    }
  };

  const removeBidHistory = async (auctionId: number, index: number) => {
    const a = auctions.find((x) => x.id === auctionId);
    if (!a) return;
    const newHistory = a.history.filter((_, i) => i !== index);
    try {
      await updateAuction(auctionId, { history: newHistory });

      const data = await getAuctions();
      setAuctions(data);
    } catch (err) {
      alert('Failed to remove bid');
    }
  };

  const getRemaining = (endTime: number) => Math.max(0, endTime - Date.now());
  const formatTime = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gavel className="text-cyan-400" size={24} />
            Auctions
          </h1>
          <p className="text-gray-500 text-sm mt-1">Bid on items with your DKP</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Create Auction
          </button>
        )}
      </div>

      {/* Auctions Grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {auctions.map((a) => {
          const ended = a.ended || Date.now() >= a.end_time;
          const remaining = getRemaining(a.end_time);

          return (
            <div key={a.id} className="card p-5 animate-fade-in">
              {a.image && (
                <img
                  src={a.image}
                  alt={a.item}
                  className="w-full h-56 object-contain bg-black rounded-2xl mb-4"
                />
              )}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xl font-bold">{a.item}</h3>
                  <div className="text-gray-500 text-sm">
                    Increment: {a.increment} DKP
                  </div>
                </div>
                {ended && (
                  <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold">
                    ENDED
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mb-3">
                <div className="text-cyan-400 text-3xl font-bold tabular-nums">
                  {a.current_bid} DKP
                </div>
                {!ended && (
                  <div className="flex items-center gap-1 text-yellow-400 text-sm font-medium">
                    <Timer size={14} />
                    {formatTime(remaining)}
                  </div>
                )}
              </div>

              <div className="text-gray-400 text-sm mb-4">
                Highest Bidder:{" "}
                <span
                  className={
                    a.highest_bidder !== 'None'
                      ? 'text-white font-medium'
                      : ''
                  }
                >
                  {a.highest_bidder}
                </span>
              </div>

              {/* Bid History */}
              {a.history.length > 0 && (
                <div className="space-y-2 mb-4 max-h-32 overflow-y-auto">
                  {a.history.map((h, i) => (
                    <div
                      key={i}
                      className="bg-black border border-[#333] rounded-xl p-2 flex justify-between items-center text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <TrendingUp
                          size={12}
                          className="text-cyan-400"
                        />
                        <span className="text-gray-300">{h.user}</span>
                        <span className="text-cyan-400 font-medium">
                          {h.bid} DKP
                        </span>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => removeBidHistory(a.id, i)}
                          className="text-red-400 hover:text-red-300 p-1 hover:bg-red-400/10 rounded transition-all"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Bid Input or Ended State */}
              {!ended ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={bidInputs[a.id] || ''}
                    onChange={(e) =>
                      setBidInputs((prev) => ({
                        ...prev,
                        [a.id]: e.target.value,
                      }))
                    }
                    placeholder={`Min ${a.current_bid + a.increment}`}
                    className="flex-1 bg-black border border-[#333] rounded-xl p-3 text-sm"
                  />
                  <button
                    onClick={() => placeBid(a.id)}
                    className="btn-primary"
                  >
                    Bid
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-red-400 font-medium text-sm">
                    This auction has ended
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteAuction(a.id)}
                      className="w-full bg-red-600/20 text-red-400 hover:bg-red-600/30 px-4 py-2 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} /> Delete Auction
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {auctions.length === 0 && (
        <div className="card p-12 text-center">
          <Gavel className="mx-auto text-gray-600 mb-3" size={48} />
          <p className="text-gray-500">No active auctions</p>
          {isAdmin && (
            <p className="text-gray-600 text-sm mt-1">
              Create one to get started
            </p>
          )}
        </div>
      )}

      {/* Create Auction Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-[#111] rounded-3xl p-6 w-full max-w-xl border border-[#222]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Gavel className="text-cyan-400" size={24} />
                Create Auction
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white p-2 hover:bg-[#222] rounded-xl transition-all"
              >
                <Plus size={20} className="rotate-45" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Item Name
                </label>
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Legendary Sword"
                  className="w-full p-3 rounded-xl bg-black border border-[#333] text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    Starting Bid
                  </label>
                  <input
                    value={startBid}
                    onChange={(e) => setStartBid(e.target.value)}
                    type="number"
                    placeholder="0"
                    className="w-full p-3 rounded-xl bg-black border border-[#333] text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    Increment
                  </label>
                  <input
                    value={increment}
                    onChange={(e) => setIncrement(e.target.value)}
                    type="number"
                    className="w-full p-3 rounded-xl bg-black border border-[#333] text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Duration (minutes)
                </label>
                <input
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  type="number"
                  className="w-full p-3 rounded-xl bg-black border border-[#333] text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Item Image (optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="w-full p-3 rounded-xl bg-black border border-[#333] text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-[#222] file:text-white"
                />
              </div>
            </div>

            <button
              onClick={handleCreateAuction}
              disabled={uploading}
              className="btn-primary w-full mt-5 py-3 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Create Auction'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
