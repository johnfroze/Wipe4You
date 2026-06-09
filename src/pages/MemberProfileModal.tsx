import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Member, DkpLog, ShopTransaction, Auction } from '@/types';
import {
  X, Crown, Star, User, Zap, Calendar,
  ShoppingBag, Gavel, TrendingUp, TrendingDown,
  Trophy, Loader2, CheckCircle2,
} from 'lucide-react';

interface Props {
  member: Member;
  onClose: () => void;
}

interface ProfileData {
  dkpLogs: DkpLog[];
  attendanceLogs: { id: number; event_name: string; dkp_awarded: number; recorded_at: string }[];
  shopPurchases: ShopTransaction[];
  auctionWins: Auction[];
}

const roleConfig = {
  leader: { icon: Crown, color: 'text-yellow-400', label: 'Leader' },
  elder:  { icon: Star,  color: 'text-purple-400', label: 'Elder'  },
  member: { icon: User,  color: 'text-gray-500',   label: 'Member' },
};

type Tab = 'overview' | 'dkp' | 'attendance' | 'shop' | 'auctions';

export function MemberProfileModal({ member, onClose }: Props) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  const rc = roleConfig[member.role];
  const RoleIcon = rc.icon;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dkpRes, attRes, shopRes, auctionRes] = await Promise.all([
        supabase.from('dkp_log').select('*').eq('member_id', member.id).order('created_at', { ascending: false }),
        supabase.from('attendance_log').select('*').eq('member_id', member.id).order('recorded_at', { ascending: false }),
        supabase.from('shop_transactions').select('*, item:shop_items(*)').eq('buyer_id', member.id).order('purchase_timestamp', { ascending: false }),
        supabase.from('auctions').select('*').eq('ended', true).eq('highest_bidder', member.username),
      ]);
      setData({
        dkpLogs: dkpRes.data || [],
        attendanceLogs: attRes.data || [],
        shopPurchases: shopRes.data || [],
        auctionWins: auctionRes.data || [],
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [member.id, member.username]);

  useEffect(() => { load(); }, [load]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview',   label: 'Overview',   icon: <User size={13} /> },
    { id: 'dkp',        label: 'DKP Log',    icon: <Zap size={13} />,          count: data?.dkpLogs.length },
    { id: 'attendance', label: 'Attendance', icon: <Calendar size={13} />,     count: data?.attendanceLogs.length },
    { id: 'shop',       label: 'Purchases',  icon: <ShoppingBag size={13} />,  count: data?.shopPurchases.length },
    { id: 'auctions',   label: 'Auctions',   icon: <Gavel size={13} />,        count: data?.auctionWins.length },
  ];

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
      <div className="bg-[#0d1117] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-[#1e2d3d] shadow-2xl animate-fade-in">

        {/* Header */}
        <div className="flex items-center gap-4 p-5 border-b border-[#1e2d3d]">
          <div className="relative shrink-0">
            <img src={member.avatar} alt="" className="w-14 h-14 rounded-full border-2 border-[#1e2d3d]" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-[#0d1117] flex items-center justify-center bg-black`}>
              <RoleIcon size={10} className={rc.color} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black truncate">{member.username}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-xs font-bold uppercase tracking-wider ${rc.color}`}>{rc.label}</span>
              <span className="text-gray-700">·</span>
              <span className="flex items-center gap-1 text-[#D4AF37] font-black text-sm hud-number">
                <Zap size={12} />{member.dkp.toLocaleString()} DKP
              </span>
              <span className="text-gray-700">·</span>
              <span className="flex items-center gap-1 text-gray-500 text-xs">
                <Calendar size={11} />{member.attendance || 0} attended
              </span>
            </div>
          </div>

          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors p-2 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                tab === t.id ? 'nav-active' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {t.icon}
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${tab === t.id ? 'bg-cyan-400/20 text-[#D4AF37]' : 'bg-white/10 text-gray-500'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading profile...</span>
            </div>
          ) : !data ? null : (

            <>
              {/* ── Overview ── */}
              {tab === 'overview' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Current DKP', value: member.dkp.toLocaleString(), color: 'text-[#D4AF37]' },
                      { label: 'Events Attended', value: member.attendance || 0, color: 'text-green-400' },
                      { label: 'Auction Wins', value: data.auctionWins.length, color: 'text-yellow-400' },
                      { label: 'Items Bought', value: data.shopPurchases.length, color: 'text-purple-400' },
                    ].map((s) => (
                      <div key={s.label} className="card-hud rounded-xl p-3 text-center">
                        <div className={`text-xl font-black hud-number ${s.color}`}>{s.value}</div>
                        <div className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-wider">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recent DKP changes */}
                  {data.dkpLogs.length > 0 && (
                    <div>
                      <h4 className="text-xs text-gray-600 uppercase tracking-wider font-bold mb-2">Recent DKP Changes</h4>
                      <div className="space-y-1.5">
                        {data.dkpLogs.slice(0, 5).map((log) => (
                          <div key={log.id} className="flex items-center justify-between bg-black/40 border border-[#1e2d3d] rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              {log.amount > 0
                                ? <TrendingUp size={12} className="text-green-400" />
                                : <TrendingDown size={12} className="text-red-400" />}
                              <span className="text-xs text-gray-300">{log.reason}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-black tabular-nums ${log.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {log.amount > 0 ? `+${log.amount}` : log.amount}
                              </span>
                              <span className="text-[10px] text-gray-700">
                                {new Date(log.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent auction wins */}
                  {data.auctionWins.length > 0 && (
                    <div>
                      <h4 className="text-xs text-gray-600 uppercase tracking-wider font-bold mb-2">Auction Wins</h4>
                      <div className="space-y-1.5">
                        {data.auctionWins.slice(0, 3).map((a) => (
                          <div key={a.id} className="flex items-center justify-between bg-black/40 border border-[#1e2d3d] rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Trophy size={12} className="text-yellow-400" />
                              <span className="text-xs text-gray-300">{a.item}</span>
                            </div>
                            <span className="text-xs text-yellow-400 font-black tabular-nums">{a.current_bid.toLocaleString()} DKP</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {member.created_at && (
                    <p className="text-xs text-gray-700 text-center pt-2">
                      Member since {new Date(member.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* ── DKP Log ── */}
              {tab === 'dkp' && (
                <div className="space-y-2 animate-fade-in">
                  {data.dkpLogs.length === 0 ? (
                    <p className="text-center text-gray-600 text-sm py-8">No DKP changes recorded</p>
                  ) : data.dkpLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between bg-black/40 border border-[#1e2d3d] rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {log.amount > 0
                          ? <TrendingUp size={14} className="text-green-400 shrink-0" />
                          : <TrendingDown size={14} className="text-red-400 shrink-0" />}
                        <div>
                          <div className="text-sm text-gray-200">{log.reason}</div>
                          <div className="text-[11px] text-gray-600">by {log.admin_name} · {new Date(log.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className={`font-black text-sm hud-number tabular-nums ${log.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {log.amount > 0 ? `+${log.amount}` : log.amount}
                        </div>
                        <div className="text-[10px] text-gray-700 tabular-nums">
                          {log.dkp_before} → {log.dkp_after}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Attendance ── */}
              {tab === 'attendance' && (
                <div className="space-y-2 animate-fade-in">
                  {data.attendanceLogs.length === 0 ? (
                    <p className="text-center text-gray-600 text-sm py-8">No attendance history</p>
                  ) : data.attendanceLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between bg-black/40 border border-[#1e2d3d] rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                        <div>
                          <div className="text-sm text-gray-200">{log.event_name}</div>
                          <div className="text-[11px] text-gray-600">{new Date(log.recorded_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <span className="text-[#D4AF37] font-black text-sm tabular-nums">+{log.dkp_awarded} DKP</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Shop ── */}
              {tab === 'shop' && (
                <div className="space-y-2 animate-fade-in">
                  {data.shopPurchases.length === 0 ? (
                    <p className="text-center text-gray-600 text-sm py-8">No purchases yet</p>
                  ) : data.shopPurchases.map((t) => (
                    <div key={t.id} className="flex items-center justify-between bg-black/40 border border-[#1e2d3d] rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <ShoppingBag size={14} className="text-[#D4AF37] shrink-0" />
                        <div>
                          <div className="text-sm text-gray-200">{t.item?.name || 'Unknown'}</div>
                          <div className="text-[11px] text-gray-600">{new Date(t.purchase_timestamp).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[#D4AF37] font-black text-sm tabular-nums">{t.total_price} DKP</div>
                        <div className={`text-[10px] font-bold ${t.distribution_status === 'distributed' ? 'text-green-500' : 'text-yellow-500'}`}>
                          {t.distribution_status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Auctions ── */}
              {tab === 'auctions' && (
                <div className="space-y-2 animate-fade-in">
                  {data.auctionWins.length === 0 ? (
                    <p className="text-center text-gray-600 text-sm py-8">No auction wins yet</p>
                  ) : data.auctionWins.map((a) => (
                    <div key={a.id} className="flex items-center justify-between bg-black/40 border border-[#1e2d3d] rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Trophy size={14} className="text-yellow-400 shrink-0" />
                        <span className="text-sm text-gray-200">{a.item}</span>
                      </div>
                      <span className="text-yellow-400 font-black text-sm tabular-nums">{a.current_bid.toLocaleString()} DKP</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
