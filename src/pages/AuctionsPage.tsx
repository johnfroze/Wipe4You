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

import {
  Gavel,
  Plus,
  Trash2,
  Timer,
  TrendingUp,
  X,
} from 'lucide-react';

interface Props {
  currentUser: CurrentUser | null;
  members: Member[];
  onMembersChange: () => void;
}

export function AuctionsPage({
  currentUser,
  members,
  onMembersChange,
}: Props) {
  const isAdmin =
    currentUser?.member.role === 'leader' ||
    currentUser?.member.role === 'elder';

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [bidInputs, setBidInputs] = useState<Record<number, string>>({});
  const [now, setNow] = useState(Date.now());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent duplicate auction ending
  const processingRef = useRef(new Set<number>());

  // Form
  const [itemName, setItemName] = useState('');
  const [startBid, setStartBid] = useState('');
  const [increment, setIncrement] = useState('1');
  const [minutes, setMinutes] = useState('60');
  const [uploading, setUploading] = useState(false);

  // Refs
  const auctionsRef = useRef(auctions);
  const membersRef = useRef(members);
  const onMembersChangeRef = useRef(onMembersChange);

  auctionsRef.current = auctions;
  membersRef.current = members;
  onMembersChangeRef.current = onMembersChange;

  // Load Auctions + Realtime
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await getAuctions();

        if (!cancelled) {
          setAuctions(data);
        }
      } catch (err) {
        console.error(err);
      }
    };

    load();

    const channel = supabase
      .channel('auction-realtime-page')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auctions',
        },
        async () => {
          const data = await getAuctions();

          if (!cancelled) {
            setAuctions(data);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;

      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  // Live timer rerender
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto end auctions
  useEffect(() => {
    const checkEndedAuctions = async () => {
      const currentAuctions = auctionsRef.current;

      for (const a of currentAuctions) {
        if (a.ended) continue;

        if (processingRef.current.has(a.id)) continue;

        if (Date.now() < a.end_time) continue;

        processingRef.current.add(a.id);

        try {
          await supabase
            .from('auctions')
            .update({ ended: true })
            .eq('id', a.id);

          if (
            a.highest_bidder &&
            a.highest_bidder !== 'None'
          ) {
            const winner = membersRef.current.find(
              (m) => m.username === a.highest_bidder
            );

            if (winner) {
              await supabase
                .from('members')
                .update({
                  dkp: Math.max(
                    0,
                    winner.dkp - a.current_bid
                  ),
                })
                .eq('id', winner.id);

              onMembersChangeRef.current();
            }
          }

          const data = await getAuctions();
          setAuctions(data);
        } catch (err) {
          console.error(err);
        } finally {
          processingRef.current.delete(a.id);
        }
      }
    };

    checkEndedAuctions();
  }, [now]);

  const handleCreateAuction = async () => {
    const item = itemName.trim();

    if (!item) {
      alert('Enter item name');
      return;
    }

    const bid = parseInt(startBid) || 0;
    const inc = parseInt(increment) || 1;
    const mins = parseInt(minutes) || 60;

    let image = '';

    const file = fileInputRef.current?.files?.[0];

    if (file) {
      try {
        setUploading(true);

        image = await uploadAuctionImage(file);
      } catch {
        alert('Image upload failed');
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

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      const data = await getAuctions();
      setAuctions(data);
    } catch {
      alert('Failed to create auction');
    }
  };

  const placeBid = async (auctionId: number) => {
    if (!currentUser?.member) {
      alert('Login first');
      return;
    }

    const auction = auctions.find(
      (a) => a.id === auctionId
    );

    if (!auction || auction.ended) {
      alert('Auction ended');
      return;
    }

    const bid = parseInt(
      bidInputs[auctionId] || ''
    );

    if (isNaN(bid)) return;

    const minimum =
      auction.current_bid + auction.increment;

    if (bid < minimum) {
      alert(`Minimum bid is ${minimum}`);
      return;
    }

    if (currentUser.member.dkp < bid) {
      alert('Not enough DKP');
      return;
    }

    let newEndTime = auction.end_time;

    const remaining =
      auction.end_time - Date.now();

    // Anti snipe
    if (remaining < 30000) {
      newEndTime += 30000;
    }

    const newHistory = [
      {
        user: currentUser.member.username,
        bid,
        timestamp: new Date().toISOString(),
      },
      ...auction.history,
    ];

    try {
      await updateAuction(auctionId, {
        current_bid: bid,
        highest_bidder:
          currentUser.member.username,
        history: newHistory,
        end_time: newEndTime,
      });

      setBidInputs((prev) => ({
        ...prev,
        [auctionId]: '',
      }));
    } catch {
      alert('Bid failed');
    }
  };

  const handleDeleteAuction = async (
    id: number
  ) => {
    if (!confirm('Delete auction?')) return;

    try {
      await deleteAuction(id);

      const data = await getAuctions();
      setAuctions(data);
    } catch {
      alert('Delete failed');
    }
  };

  const removeBidHistory = async (
    auctionId: number,
    index: number
  ) => {
    const auction = auctions.find(
      (a) => a.id === auctionId
    );

    if (!auction) return;

    const newHistory =
      auction.history.filter(
        (_, i) => i !== index
      );

    try {
      await updateAuction(auctionId, {
        history: newHistory,
      });

      const data = await getAuctions();
      setAuctions(data);
    } catch {
      alert('Failed');
    }
  };

  const getRemaining = (
    endTime: number
  ) => {
    return Math.max(0, endTime - now);
  };

  const formatTime = (ms: number) => {
    if (ms <= 0) return 'Ended';

    const hours = Math.floor(
      ms / (1000 * 60 * 60)
    );

    const minutes = Math.floor(
      (ms % (1000 * 60 * 60)) /
        (1000 * 60)
    );

    const seconds = Math.floor(
      (ms % (1000 * 60)) / 1000
    );

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gavel
            className="text-cyan-400"
            size={24}
          />
          Auctions
        </h1>

        {isAdmin && (
          <button
            onClick={() =>
              setShowModal(true)
            }
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Create Auction
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {auctions.map((a) => {
          const ended =
            a.ended ||
            now >= a.end_time;

          const remaining =
            getRemaining(a.end_time);

          return (
            <div
              key={a.id}
              className="card p-5"
            >
              {a.image && (
                <img
                  src={a.image}
                  alt={a.item}
                  className="w-full h-56 object-contain bg-black rounded-2xl mb-4"
                />
              )}

              <div className="flex justify-between mb-3">
                <div>
                  <h3 className="text-xl font-bold">
                    {a.item}
                  </h3>

                  <div className="text-gray-500 text-sm">
                    Increment:
                    {a.increment} DKP
                  </div>
                </div>

                {ended && (
                  <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold">
                    ENDED
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mb-3">
                <div className="text-cyan-400 text-3xl font-bold">
                  {a.current_bid} DKP
                </div>

                {!ended && (
                  <div className="flex items-center gap-1 text-yellow-400 text-sm">
                    <Timer size={14} />
                    {formatTime(remaining)}
                  </div>
                )}
              </div>

              <div className="text-gray-400 text-sm mb-4">
                Highest Bidder:
                <span className="text-white font-medium ml-1">
                  {a.highest_bidder}
                </span>
              </div>

              {a.history.length > 0 && (
                <div className="space-y-2 mb-4 max-h-32 overflow-y-auto">
                  {a.history.map(
                    (h, i) => (
                      <div
                        key={i}
                        className="bg-black border border-[#333] rounded-xl p-2 flex justify-between items-center text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <TrendingUp
                            size={12}
                            className="text-cyan-400"
                          />

                          <span className="text-gray-300">
                            {h.user}
                          </span>

                          <span className="text-cyan-400 font-medium">
                            {h.bid} DKP
                          </span>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() =>
                              removeBidHistory(
                                a.id,
                                i
                              )
                            }
                            className="text-red-400"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}

              {!ended ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={
                      bidInputs[a.id] || ''
                    }
                    onChange={(e) =>
                      setBidInputs(
                        (prev) => ({
                          ...prev,
                          [a.id]:
                            e.target.value,
                        })
                      )
                    }
                    placeholder={`Min ${
                      a.current_bid +
                      a.increment
                    }`}
                    className="flex-1 bg-black border border-[#333] rounded-xl p-3 text-sm"
                  />

                  <button
                    onClick={() =>
                      placeBid(a.id)
                    }
                    className="btn-primary"
                  >
                    Bid
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-red-400 text-sm">
                    Auction Ended
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() =>
                        handleDeleteAuction(
                          a.id
                        )
                      }
                      className="w-full bg-red-600/20 text-red-400 hover:bg-red-600/30 px-4 py-2 rounded-xl text-sm flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} />
                      Delete Auction
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <input
                value={itemName}
                onChange={(e) =>
                  setItemName(e.target.value)
                }
                placeholder="Item Name"
                className="w-full p-3 rounded-xl bg-black border border-[#333]"
              />

              <input
                value={startBid}
                onChange={(e) =>
                  setStartBid(e.target.value)
                }
                type="number"
                placeholder="Starting Bid"
                className="w-full p-3 rounded-xl bg-black border border-[#333]"
              />

              <input
                value={increment}
                onChange={(e) =>
                  setIncrement(e.target.value)
                }
                type="number"
                placeholder="Increment"
                className="w-full p-3 rounded-xl bg-black border border-[#333]"
              />

              <input
                value={minutes}
                onChange={(e) =>
                  setMinutes(e.target.value)
                }
                type="number"
                placeholder="Duration Minutes"
                className="w-full p-3 rounded-xl bg-black border border-[#333]"
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="w-full p-3 rounded-xl bg-black border border-[#333]"
              />
            </div>

            <button
              onClick={handleCreateAuction}
              disabled={uploading}
              className="btn-primary w-full mt-5 py-3"
            >
              {uploading
                ? 'Uploading...'
                : 'Create Auction'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
