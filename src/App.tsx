import { useState, useEffect } from 'react';
import { signInWithDiscord, signOut, supabase, subscribeMembersRealtime } from '@/lib/supabase';
import { useAuth, useMembers } from '@/hooks/useAuth';
import { AttendancePage } from '@/pages/AttendancePage';
import { AuctionsPage } from '@/pages/AuctionsPage';
import { AdminPage } from '@/pages/AdminPage';
import { ShopPage } from '@/pages/ShopPage';
import { ShopLogPage } from '@/pages/ShopLogPage';
import { MyHistoryPage } from '@/pages/MyHistoryPage';
import { AnnouncementsPage } from '@/pages/AnnouncementsPage';
import { DkpLogPage } from '@/pages/DkpLogPage';
import {
  Shield, LogOut, ShoppingBag, ScrollText,
  Package, Gavel, Clock, Menu, X, Zap, AlertTriangle,
  Megaphone, ClipboardList,
} from 'lucide-react';
import './App.css';

type PageId = 'attendance' | 'auctions' | 'shop' | 'shop-log' | 'my-history' | 'admin' | 'announcements' | 'dkp-log';

function App() {
  const { currentUser, loading, isAdmin, authError } = useAuth();
  const { members, loadMembers } = useMembers();

  const [page, setPage] = useState<PageId>('attendance');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [auctionNotifications, setAuctionNotifications] = useState(0);
  const [liveDkp, setLiveDkp] = useState(0);

  // Sync DKP from currentUser on mount
  useEffect(() => {
    if (currentUser?.member) setLiveDkp(currentUser.member.dkp);
  }, [currentUser]);

  // Realtime: current user's own DKP (instant navbar update)
  useEffect(() => {
    if (!currentUser?.member?.id) return;
    const channel = supabase
      .channel('member-dkp-realtime')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'members',
        filter: `id=eq.${currentUser.member.id}`,
      }, (payload: any) => {
        if (payload.new?.dkp !== undefined) setLiveDkp(payload.new.dkp);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Realtime: ALL member changes → reload members list so
  // attendance, leaderboard and admin panel stay in sync
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeMembersRealtime(() => {
      loadMembers();
    });
    return () => { unsubscribe(); };
  }, [currentUser, loadMembers]);

  // Realtime: auction activity badge on nav
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
      .from('members').select('dkp').eq('id', currentUser.member.id).single();
    if (data?.dkp !== undefined) setLiveDkp(data.dkp);
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen loading-screen text-white flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-[#1e2d3d] animate-spin border-t-cyan-400" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Shield size={20} className="text-cyan-400" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-cyan-400 font-bold tracking-widest text-sm uppercase hud-number">
            Initializing
          </p>
          <p className="text-gray-600 text-xs mt-1">Wipe4You Dashboard</p>
        </div>
      </div>
    );
  }

  // ── Auth error (not in guild Discord) ──
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
        <button
          onClick={signInWithDiscord}
          className="btn-primary flex items-center gap-2 mt-2"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Login page ──
  if (!currentUser) return <HomePage onLogin={signInWithDiscord} />;

  const navItems: { id: PageId; label: string; icon: React.ReactNode; admin?: boolean }[] = [
    { id: 'announcements', label: 'News',         icon: <Megaphone size={16} /> },
    { id: 'attendance',    label: 'Attendance',   icon: <Clock size={16} /> },
    { id: 'auctions',      label: 'Auctions',     icon: <Gavel size={16} /> },
    { id: 'shop',          label: 'DKP Shop',     icon: <ShoppingBag size={16} /> },
    { id: 'my-history',    label: 'My Purchases', icon: <Package size={16} /> },
    { id: 'dkp-log',       label: 'DKP Log',      icon: <ClipboardList size={16} />, admin: true },
    { id: 'shop-log',      label: 'Shop Log',     icon: <ScrollText size={16} />, admin: true },
    { id: 'admin',         label: 'Admin',        icon: <Shield size={16} />, admin: true },
  ];

  const visibleNavItems = navItems.filter((i) => !i.admin || isAdmin);

  const navigate = (id: PageId) => {
    if (page === id) { window.location.reload(); return; }
    setPage(id);
    setMobileMenuOpen(false);
    if (id === 'attendance') loadMembers();
    if (id === 'auctions') setAuctionNotifications(0);
  };

  const roleColor = currentUser.member.role === 'leader'
    ? 'text-yellow-400' : currentUser.member.role === 'elder'
    ? 'text-purple-400' : 'text-gray-500';

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans">

      {/* ── Navbar ── */}
      <nav className="border-b border-[#1e2d3d] sticky top-0 z-40 bg-[#050508]/95 backdrop-blur-md">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">

            {/* Left: logo + mobile toggle */}
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden text-gray-500 hover:text-cyan-400 transition-colors p-1"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
                  <Shield size={16} className="text-cyan-400" />
                </div>
                <div className="hidden sm:block">
                  <span className="font-black text-base tracking-wide text-white">
                    WIPE<span className="text-cyan-400">4</span>YOU
                  </span>
                  <div className="text-[10px] text-gray-600 tracking-widest uppercase -mt-0.5">
                    Guild Dashboard
                  </div>
                </div>
              </div>
            </div>

            {/* Center: desktop nav */}
            <div className="hidden lg:flex items-center gap-1">
              {visibleNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all text-sm font-medium relative ${
                    page === item.id
                      ? 'nav-active'
                      : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.id === 'auctions' && auctionNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {auctionNotifications}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Right: user info */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-400/8 border border-cyan-400/20">
                <Zap size={13} className="text-cyan-400" />
                <span className="text-cyan-400 font-bold text-sm hud-number tabular-nums">
                  {liveDkp.toLocaleString()}
                </span>
                <span className="text-cyan-700 text-xs font-bold">DKP</span>
              </div>

              <img
                src={currentUser.user.user_metadata.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full border-2 border-[#1e2d3d]"
              />

              <div className="hidden md:block text-right">
                <div className="text-sm font-semibold leading-tight truncate max-w-[100px]">
                  {currentUser.user.user_metadata.full_name}
                </div>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${roleColor}`}>
                  {currentUser.member.role}
                </div>
              </div>

              <button
                onClick={signOut}
                className="text-gray-600 hover:text-red-400 transition-colors p-2 hover:bg-red-400/8 rounded-xl ml-1"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-3 pt-3 border-t border-[#1e2d3d] flex flex-col gap-1 animate-fade-in">
              <div className="flex items-center gap-2 px-3 py-2 mb-1">
                <Zap size={14} className="text-cyan-400" />
                <span className="text-cyan-400 font-bold hud-number">{liveDkp.toLocaleString()} DKP</span>
                <span className={`text-xs font-bold uppercase ml-auto ${roleColor}`}>
                  {currentUser.member.role}
                </span>
              </div>
              {visibleNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                    page === item.id ? 'nav-active' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.id === 'auctions' && auctionNotifications > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                      {auctionNotifications}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {page === 'announcements' && (
          <AnnouncementsPage currentUser={currentUser} />
        )}
        {page === 'attendance' && (
          <AttendancePage currentUser={currentUser} members={members} onMembersChange={loadMembers} />
        )}
        {page === 'auctions' && (
          <AuctionsPage currentUser={currentUser} members={members} onMembersChange={loadMembers} />
        )}
        {page === 'shop' && (
          <ShopPage currentUser={currentUser} onDkpChange={refreshDkp} />
        )}
        {page === 'shop-log' && isAdmin && <ShopLogPage />}
        {page === 'dkp-log' && isAdmin && <DkpLogPage currentUser={currentUser} />}
        {page === 'my-history' && (
          <MyHistoryPage buyerId={currentUser.member.id} />
        )}
        {page === 'admin' && isAdmin && (
          <AdminPage members={members} onMembersChange={loadMembers} currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}

export default App;
