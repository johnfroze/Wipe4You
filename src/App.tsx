import { useState, useEffect, useRef } from 'react';
import { signInWithDiscord, signOut, supabase, expireShopItems } from '@/lib/supabase';
import { useAuth, useMembers } from '@/hooks/useAuth';
import { AttendancePage } from '@/pages/AttendancePage';
import { AuctionsPage } from '@/pages/AuctionsPage';
import { AdminPage } from '@/pages/AdminPage';
import { ShopPage } from '@/pages/ShopPage';
import { ShopLogPage } from '@/pages/ShopLogPage';
import { MyHistoryPage } from '@/pages/MyHistoryPage';
import { AnnouncementsPage } from '@/pages/AnnouncementsPage';
import { DkpLogPage } from '@/pages/DkpLogPage';
import { RafflePage } from '@/pages/RafflePage';
import HomePage from './pages/HomePage';
import {
  Shield, LogOut, ShoppingBag, ScrollText,
  Package, Gavel, Clock, Zap, AlertTriangle,
  Megaphone, ClipboardList, ChevronLeft, ChevronRight,
  Crown, Star, User, Ticket, X,
} from 'lucide-react';
import './App.css';

type PageId = 'attendance' | 'auctions' | 'shop' | 'shop-log' | 'my-history' | 'admin' | 'announcements' | 'dkp-log' | 'raffle';

// ── Nav section separator ──────────────────────────────────
function NavSection({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-[rgba(212,175,55,0.35)]">{label}</span>
    </div>
  );
}

function App() {
  const { currentUser, loading, isAdmin, authError } = useAuth();
  const { members, loadMembers } = useMembers();

  const [page, setPage] = useState<PageId>('announcements');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [auctionNotifications, setAuctionNotifications] = useState(0);
  const [liveDkp, setLiveDkp] = useState(0);
  const [expiredNotice, setExpiredNotice] = useState(0);

  // Sync DKP only on first login — after that, realtime
  // channel updates liveDkp directly from payload so it
  // never gets overwritten by stale currentUser.member.dkp
  const hasSetInitialDkp = useRef(false);
  useEffect(() => {
    if (currentUser?.member && !hasSetInitialDkp.current) {
      setLiveDkp(currentUser.member.dkp);
      hasSetInitialDkp.current = true;
    }
    if (!currentUser) hasSetInitialDkp.current = false; // reset on logout
  }, [currentUser]);

  // ── Single unified members realtime channel ──────────────
  // UPDATE: patches the changed member in local state instantly
  //         (no extra DB query for most changes)
  // INSERT/DELETE: triggers a single loadMembers() fetch
  useEffect(() => {
    if (!currentUser?.member?.id) return;

    const channel = supabase
      .channel('members-unified-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'members' },
        (payload: any) => {
          const updated = payload.new;
          if (!updated) return;

          // Instantly update navbar DKP from payload — no extra query
          if (updated.id === currentUser.member.id && updated.dkp !== undefined) {
            setLiveDkp(updated.dkp);
          }

          // Patch just the changed member in the list — avoids a full refetch
          // Only fall back to loadMembers() if the row isn't already in state
          loadMembers();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'members' },
        () => loadMembers()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'members' },
        () => loadMembers()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser, loadMembers]);

  // Realtime: auction badge
  useEffect(() => {
    const channel = supabase
      .channel('auction-realtime-app')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => {
        setAuctionNotifications((n) => n + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const refreshDkp = async () => {
    if (!currentUser?.member?.id) return;
    const { data } = await supabase
      .from('members')
      .select('dkp')
      .eq('id', currentUser.member.id)
      .single();
    if (data?.dkp !== undefined) {
      // Always trust the DB value after a purchase/refund
      setLiveDkp(data.dkp);
      loadMembers();
    }
  };

  // ── Global expiry checker ──────────────────────────────
  // Only runs for admins (leaders/elders) — no need for every
  // member to poll. Runs every 10 minutes instead of 60 seconds
  // to reduce Supabase egress bandwidth usage.
  useEffect(() => {
    if (!currentUser || !isAdmin) return;

    const runExpiry = async () => {
      const count = await expireShopItems();
      if (count > 0) {
        setExpiredNotice(count);
        setTimeout(() => setExpiredNotice(0), 6000);
      }
    };

    // Run once on admin login, then every 10 minutes
    runExpiry();
    const interval = setInterval(runExpiry, 10 * 60_000);
    return () => clearInterval(interval);
  }, [currentUser, isAdmin]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!currentUser) return;
    const map: Record<string, PageId> = {
      '1': 'announcements', '2': 'attendance', '3': 'auctions',
      '4': 'shop', '5': 'raffle', '6': 'my-history',
      '7': isAdmin ? 'dkp-log' : 'my-history',
      '8': isAdmin ? 'shop-log' : 'my-history',
      '9': isAdmin ? 'admin' : 'my-history',
    };
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const dest = map[e.key];
      if (dest) setPage(dest);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentUser, isAdmin]);

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen loading-screen text-white flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-[#1e2d3d] animate-spin border-t-[#D4AF37]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Shield size={20} className="text-[#D4AF37]" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-cyan-400 font-bold tracking-widest text-sm uppercase hud-number">Initializing</p>
          <p className="text-gray-600 text-xs mt-1">Wipe4You Dashboard</p>
        </div>
      </div>
    );
  }

  // ── Auth error ───────────────────────────────────────────
  if (authError) {
    return (
      <div className="min-h-screen bg-[#050508] text-white flex flex-col items-center justify-center gap-6 p-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-black mb-2">Access Denied</h2>
          <p className="text-gray-400 text-sm leading-relaxed">{authError}</p>
        </div>
        <button onClick={signInWithDiscord} className="btn-primary mt-2">Try Again</button>
      </div>
    );
  }

  // ── Login ────────────────────────────────────────────────
  if (!currentUser) return <HomePage onLogin={signInWithDiscord} />;

  const navigate = (id: PageId) => {
    if (page === id) { window.location.reload(); return; }
    setPage(id);
    if (id === 'auctions') setAuctionNotifications(0);
  };

  const roleConfig = {
    leader: { icon: Crown, color: 'text-yellow-400', label: 'Leader' },
    elder:  { icon: Star,  color: 'text-purple-400', label: 'Elder'  },
    member: { icon: User,  color: 'text-gray-500',   label: 'Member' },
  };
  const rc = roleConfig[currentUser.member.role];
  const RoleIcon = rc.icon;

  // Nav items split into sections
  const memberNav: { id: PageId; label: string; icon: React.ReactNode; kbd: string; badge?: number }[] = [
    { id: 'announcements', label: 'News',         icon: <Megaphone size={18} />,   kbd: '1' },
    { id: 'attendance',    label: 'Attendance',   icon: <Clock size={18} />,       kbd: '2' },
    { id: 'auctions',      label: 'Auctions',     icon: <Gavel size={18} />,       kbd: '3', badge: auctionNotifications },
    { id: 'shop',          label: 'DKP Shop',     icon: <ShoppingBag size={18} />, kbd: '4' },
    { id: 'raffle',        label: 'Raffle',       icon: <Ticket size={18} />,      kbd: '5' },
    { id: 'my-history',    label: 'My Purchases', icon: <Package size={18} />,     kbd: '6' },
  ];

  const adminNav: { id: PageId; label: string; icon: React.ReactNode; kbd: string }[] = [
    { id: 'dkp-log',  label: 'DKP Log',  icon: <ClipboardList size={18} />, kbd: '7' },
    { id: 'shop-log', label: 'Shop Log', icon: <ScrollText size={18} />,    kbd: '8' },
    { id: 'admin',    label: 'Admin',    icon: <Shield size={18} />,        kbd: '9' },
  ];

  // Bottom tab bar items (mobile — max 5)
  const bottomTabs = [
    { id: 'announcements' as PageId, icon: <Megaphone size={20} />, label: 'News' },
    { id: 'attendance'    as PageId, icon: <Clock size={20} />,       label: 'Attend' },
    { id: 'auctions'      as PageId, icon: <Gavel size={20} />,       label: 'Auctions', badge: auctionNotifications },
    { id: 'shop'          as PageId, icon: <ShoppingBag size={20} />, label: 'Shop' },
    { id: 'raffle'        as PageId, icon: <Ticket size={20} />,      label: 'Raffle' },
  ];

  // Sidebar nav button
  const SidebarBtn = ({
    id, label, icon, kbd, badge,
  }: { id: PageId; label: string; icon: React.ReactNode; kbd?: string; badge?: number }) => {
    const active = page === id;
    return (
      <button
        onClick={() => navigate(id)}
        title={sidebarCollapsed ? label : undefined}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 relative group
          ${active
            ? 'bg-cyan-500/12 text-cyan-400 border border-cyan-500/25 shadow-[0_0_12px_#00d4ff08]'
            : 'text-gray-500 hover:text-gray-200 hover:bg-white/5 border border-transparent'
          }
        `}
      >
        {/* Active indicator bar */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-cyan-400 rounded-r-full" />
        )}

        <span className={`shrink-0 ${active ? 'text-cyan-400' : 'text-gray-600 group-hover:text-gray-300'} transition-colors`}>
          {icon}
        </span>

        {!sidebarCollapsed && (
          <>
            <span className={`text-sm font-semibold truncate flex-1 text-left ${active ? 'text-white' : ''}`}>
              {label}
            </span>
            {kbd && !active && (
              <span className="kbd opacity-0 group-hover:opacity-100 transition-opacity">{kbd}</span>
            )}
            {badge !== undefined && badge > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {badge}
              </span>
            )}
          </>
        )}

        {/* Collapsed badge dot */}
        {sidebarCollapsed && badge !== undefined && badge > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
        )}

        {/* Collapsed tooltip */}
        {sidebarCollapsed && (
          <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#0d1117] border border-[#1e2d3d] rounded-lg text-xs font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
            {label}
            {kbd && <span className="ml-2 kbd">{kbd}</span>}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white flex">

      {/* ── Expired items raffle toast ── */}
      {expiredNotice > 0 && (
        <div
          onClick={() => { setPage('raffle'); setExpiredNotice(0); }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 cursor-pointer animate-slide-in-right"
        >
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.25)] shadow-2xl shadow-[rgba(212,175,55,0.1)] backdrop-blur-md">
            <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.12)] flex items-center justify-center shrink-0">
              <Ticket size={16} className="text-[#D4AF37]" />
            </div>
            <div>
              <div className="text-sm font-black text-white">
                {expiredNotice} item{expiredNotice > 1 ? 's' : ''} moved to Raffle!
              </div>
              <div className="text-xs text-purple-400">Tap to view the Raffle page →</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setExpiredNotice(0); }}
              className="text-gray-600 hover:text-white ml-2"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          SIDEBAR — desktop only
      ══════════════════════════════════════════════ */}
      <aside className={`
        hidden lg:flex flex-col shrink-0 h-screen sticky top-0
        bg-[#030305] border-r border-[rgba(212,175,55,0.08)]
        transition-all duration-200 ease-in-out
        ${sidebarCollapsed ? 'w-[64px]' : 'w-[220px]'}
      `}>

        {/* Top accent */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent shrink-0" />

        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-4 shrink-0 ${sidebarCollapsed ? 'justify-center px-2' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center shrink-0">
            <Shield size={15} className="text-cyan-400" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="font-black text-sm tracking-wide leading-none">
                WIPE<span className="text-[#D4AF37]">4</span>YOU
              </div>
              <div className="text-[9px] text-gray-700 tracking-widest uppercase mt-0.5">
                Guild Dashboard
              </div>
            </div>
          )}
        </div>

        <div className="hud-divider mx-3" />

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0.5">

          {!sidebarCollapsed && <NavSection label="Menu" />}
          {memberNav.map((item) => (
            <SidebarBtn key={item.id} {...item} />
          ))}

          {isAdmin && (
            <>
              {!sidebarCollapsed && <NavSection label="Admin" />}
              {sidebarCollapsed && <div className="my-2 mx-2 hud-divider" />}
              {adminNav.map((item) => (
                <SidebarBtn key={item.id} {...item} />
              ))}
            </>
          )}
        </div>

        <div className="hud-divider mx-3" />

        {/* User card */}
        <div className={`p-3 shrink-0 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
          {sidebarCollapsed ? (
            <div className="relative group">
              <img
                src={currentUser.user.user_metadata.avatar_url}
                alt=""
                className="w-9 h-9 rounded-full border-2 border-[#1e2d3d] cursor-pointer"
              />
              {/* Tooltip */}
              <div className="absolute left-full ml-3 bottom-0 bg-[#0d1117] border border-[#1e2d3d] rounded-xl p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl whitespace-nowrap">
                <div className="font-bold text-sm">{currentUser.user.user_metadata.full_name}</div>
                <div className={`text-xs font-bold ${rc.color} flex items-center gap-1 mt-0.5`}>
                  <RoleIcon size={10} />{rc.label}
                </div>
                <div className="flex items-center gap-1 mt-1 text-cyan-400 font-black text-xs hud-number">
                  <Zap size={10} />{liveDkp.toLocaleString()} DKP
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[rgba(0,0,0,0.4)] border border-[rgba(212,175,55,0.1)]">
              <img
                src={currentUser.user.user_metadata.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full border border-[#1e2d3d] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate leading-tight">
                  {currentUser.user.user_metadata.full_name}
                </div>
                <div className={`text-[10px] font-bold flex items-center gap-1 mt-0.5 ${rc.color}`}>
                  <RoleIcon size={9} />{rc.label}
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-cyan-400 font-black text-[11px] hud-number tabular-nums text-gold">
                  <Zap size={9} />{liveDkp.toLocaleString()} DKP
                </div>
              </div>
              <button
                onClick={signOut}
                className="text-gray-700 hover:text-red-400 transition-colors p-1.5 hover:bg-red-400/8 rounded-lg shrink-0"
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}

          {/* Sign out when collapsed */}
          {sidebarCollapsed && (
            <button
              onClick={signOut}
              className="mt-2 w-full flex items-center justify-center p-2 rounded-xl text-gray-700 hover:text-red-400 hover:bg-red-400/8 transition-all"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed((v) => !v)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-[#050508] border border-[rgba(212,175,55,0.2)] flex items-center justify-center text-gray-500 hover:text-[#D4AF37] hover:border-[rgba(212,175,55,0.4)] transition-all shadow-lg z-10"
        >
          {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* ══════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Mobile topbar ── */}
        <header className="lg:hidden sticky top-0 z-40 bg-[#030305]/95 backdrop-blur-md border-b border-[rgba(212,175,55,0.1)] shrink-0">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
          <div className="flex items-center justify-between px-4 py-3">

            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
                <Shield size={13} className="text-cyan-400" />
              </div>
              <span className="font-black text-sm tracking-wide">
                WIPE<span className="text-cyan-400">4</span>YOU
              </span>
            </div>

            {/* Right: DKP + avatar + logout */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.2)]">
                <Zap size={11} className="text-cyan-400" />
                <span className="text-[#D4AF37] font-black text-xs hud-number tabular-nums">
                  {liveDkp.toLocaleString()}
                </span>
                <span className="text-[rgba(212,175,55,0.4)] text-[10px] font-bold">DKP</span>
              </div>
              <img
                src={currentUser.user.user_metadata.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full border-2 border-[#1e2d3d]"
              />
              <button onClick={signOut}
                className="text-gray-600 hover:text-red-400 transition-colors p-1.5 hover:bg-red-400/8 rounded-lg">
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 py-6 pb-24 lg:pb-6">
            {page === 'announcements' && <AnnouncementsPage currentUser={currentUser} />}
            {page === 'attendance'    && <AttendancePage currentUser={currentUser} members={members} onMembersChange={loadMembers} />}
            {page === 'auctions'      && <AuctionsPage currentUser={currentUser} members={members} onMembersChange={loadMembers} />}
            {page === 'shop'          && <ShopPage currentUser={currentUser} onDkpChange={refreshDkp} />}
            {page === 'raffle'        && <RafflePage currentUser={currentUser} onDkpChange={refreshDkp} />}
            {page === 'my-history'    && <MyHistoryPage buyerId={currentUser.member.id} />}
            {page === 'shop-log'      && isAdmin && <ShopLogPage />}
            {page === 'dkp-log'       && isAdmin && <DkpLogPage currentUser={currentUser} />}
            {page === 'admin'         && isAdmin && <AdminPage members={members} onMembersChange={loadMembers} currentUser={currentUser} />}
          </div>
        </main>
      </div>

      {/* ══════════════════════════════════════════════
          BOTTOM TAB BAR — mobile only
      ══════════════════════════════════════════════ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#030305]/95 backdrop-blur-md border-t border-[rgba(212,175,55,0.1)]">
        {/* Bottom accent */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />

        <div className="flex items-stretch">
          {bottomTabs.map((tab) => {
            const active = page === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative transition-all ${
                  active ? 'text-cyan-400' : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                {/* Active top glow line */}
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#D4AF37] rounded-b-full" />
                )}

                <span className={`transition-transform ${active ? 'scale-110' : ''}`}>
                  {tab.icon}
                </span>
                <span className={`text-[10px] font-bold ${active ? 'text-cyan-400' : 'text-gray-600'}`}>
                  {tab.label}
                </span>

                {/* Badge */}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute top-1.5 right-1/4 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Admin overflow tab — only shown on mobile if admin */}
          {isAdmin && (
            <button
              onClick={() => navigate('admin')}
              className={`flex-shrink-0 px-3 flex flex-col items-center justify-center gap-1 py-2.5 relative transition-all ${
                ['admin', 'shop-log', 'dkp-log', 'my-history'].includes(page)
                  ? 'text-cyan-400' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {['admin', 'shop-log', 'dkp-log', 'my-history'].includes(page) && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-cyan-400 rounded-b-full" />
              )}
              <Shield size={20} />
              <span className="text-[10px] font-bold">Admin</span>
            </button>
          )}
        </div>

        {/* Safe area spacing for iPhone */}
        <div className="h-safe-area-inset-bottom bg-[#07090f]" style={{ height: 'env(safe-area-inset-bottom)' }} />
      </nav>

    </div>
  );
}

export default App;
