import {
  useState,
  useEffect,
} from 'react';

import {
  signInWithDiscord,
  signOut,
  supabase,
} from '@/lib/supabase';

import {
  useAuth,
  useMembers,
} from '@/hooks/useAuth';

import { AttendancePage } from '@/pages/AttendancePage';
import { AuctionsPage } from '@/pages/AuctionsPage';
import { AdminPage } from '@/pages/AdminPage';
import { ShopPage } from '@/pages/ShopPage';
import { ShopLogPage } from '@/pages/ShopLogPage';
import { MyHistoryPage } from '@/pages/MyHistoryPage';

// HOMEPAGE
import HomePage from './pages/HomePage';

import {
  Shield,
  LogOut,
  ShoppingBag,
  ScrollText,
  Package,
  Gavel,
  Clock,
  Menu,
  X,
} from 'lucide-react';

import './App.css';

type PageId =
  | 'attendance'
  | 'auctions'
  | 'shop'
  | 'shop-log'
  | 'my-history'
  | 'admin';

function App() {
  const {
    currentUser,
    loading,
    isAdmin,
  } = useAuth();

  const {
    members,
    loadMembers,
  } = useMembers();

  const [page, setPage] =
    useState<PageId>(
      'attendance'
    );

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false);

  const [
    auctionNotifications,
    setAuctionNotifications,
  ] = useState(0);

  // LIVE DKP
  const [liveDkp, setLiveDkp] =
    useState(0);

  // SYNC DKP
  useEffect(() => {
    if (currentUser?.member) {
      setLiveDkp(
        currentUser.member.dkp
      );
    }
  }, [currentUser]);

  // REALTIME DKP
  useEffect(() => {
    if (!currentUser?.member?.id)
      return;

    const channel = supabase
      .channel(
        'member-dkp-realtime'
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'members',
          filter: `id=eq.${currentUser.member.id}`,
        },
        (payload: any) => {
          if (
            payload.new?.dkp !==
            undefined
          ) {
            setLiveDkp(
              payload.new.dkp
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [currentUser]);

  // AUCTION REALTIME
  useEffect(() => {
    const channel = supabase
      .channel(
        'auction-realtime-app'
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auctions',
        },
        () => {
          setAuctionNotifications(
            (n) => n + 1
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, []);

  // REFRESH DKP
  const refreshDkp =
    async () => {
      if (
        !currentUser?.member?.id
      )
        return;

      try {
        const {
          data,
          error,
        } = await supabase
          .from('members')
          .select('dkp')
          .eq(
            'id',
            currentUser.member.id
          )
          .single();

        if (error) {
          throw error;
        }

        if (
          data?.dkp !== undefined
        ) {
          setLiveDkp(data.dkp);
        }
      } catch (err) {
        console.error(err);
      }
    };

  // LOADING
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400" />
      </div>
    );
  }

  // HOMEPAGE BEFORE LOGIN
  if (!currentUser) {
    return (
      <HomePage
        onLogin={
          signInWithDiscord
        }
      />
    );
  }

  // NAV ITEMS
  const navItems: {
    id: PageId;
    label: string;
    icon: React.ReactNode;
    admin?: boolean;
  }[] = [
    {
      id: 'attendance',
      label: 'Attendance',
      icon: <Clock size={18} />,
    },
    {
      id: 'auctions',
      label: 'Auctions',
      icon: <Gavel size={18} />,
    },
    {
      id: 'shop',
      label: 'DKP Shop',
      icon: (
        <ShoppingBag size={18} />
      ),
    },
    {
      id: 'my-history',
      label: 'My Purchases',
      icon: <Package size={18} />,
    },
    {
      id: 'shop-log',
      label: 'Shop Log',
      icon: (
        <ScrollText size={18} />
      ),
      admin: true,
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: <Shield size={18} />,
      admin: true,
    },
  ];

  const visibleNavItems =
    navItems.filter(
      (item) =>
        !item.admin ||
        isAdmin
    );

  return (
    <div className="min-h-screen bg-[#070707] text-white font-sans">
      {/* NAVBAR */}
      <nav className="border-b border-[#222] sticky top-0 z-40 bg-[#070707]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            {/* LEFT */}
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden text-gray-400 hover:text-white"
                onClick={() =>
                  setMobileMenuOpen(
                    !mobileMenuOpen
                  )
                }
              >
                {mobileMenuOpen ? (
                  <X size={24} />
                ) : (
                  <Menu size={24} />
                )}
              </button>

              <div className="flex items-center gap-2">
                <Shield
                  className="text-cyan-400"
                  size={24}
                />

                <span className="font-bold text-lg hidden sm:block">
                  Wipe4You Dashboard
                </span>
              </div>
            </div>

            {/* DESKTOP NAV */}
            <div className="hidden lg:flex items-center gap-1">
              {visibleNavItems.map(
                (item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      // REFRESH SAME PAGE
                      if (
                        page === item.id
                      ) {
                        window.location.reload();

                        return;
                      }

                      setPage(
                        item.id
                      );

                      // REFRESH ATTENDANCE
                      if (
                        item.id ===
                        'attendance'
                      ) {
                        loadMembers();
                      }

                      // CLEAR AUCTION NOTIFICATIONS
                      if (
                        item.id ===
                        'auctions'
                      ) {
                        setAuctionNotifications(
                          0
                        );
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                      page === item.id
                        ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20'
                        : 'text-gray-400 hover:text-white hover:bg-[#111]'
                    }`}
                  >
                    {item.icon}

                    <span className="text-sm font-medium">
                      {item.label}
                    </span>

                    {item.id ===
                      'auctions' &&
                      auctionNotifications >
                        0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {
                            auctionNotifications
                          }
                        </span>
                      )}
                  </button>
                )
              )}
            </div>

            {/* USER */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end mr-1">
                <span className="text-sm font-medium text-cyan-400">
                  {liveDkp} DKP
                </span>

                <span className="text-xs text-gray-500 capitalize">
                  {
                    currentUser
                      .member.role
                  }
                </span>
              </div>

              <img
                src={
                  currentUser.user
                    .user_metadata
                    .avatar_url
                }
                alt=""
                className="w-9 h-9 rounded-full border border-[#333]"
              />

              <span className="hidden md:block text-sm font-medium max-w-[120px] truncate">
                {
                  currentUser.user
                    .user_metadata
                    .full_name
                }
              </span>

              <button
                onClick={() =>
                  signOut()
                }
                className="text-gray-400 hover:text-red-400 transition-colors p-2 hover:bg-red-400/10 rounded-xl"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          {/* MOBILE MENU */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-3 pt-3 border-t border-[#222] flex flex-col gap-1">
              {visibleNavItems.map(
                (item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      // REFRESH SAME PAGE
                      if (
                        page === item.id
                      ) {
                        window.location.reload();

                        return;
                      }

                      setPage(
                        item.id
                      );

                      setMobileMenuOpen(
                        false
                      );

                      // REFRESH ATTENDANCE
                      if (
                        item.id ===
                        'attendance'
                      ) {
                        loadMembers();
                      }

                      // CLEAR AUCTION NOTIFICATIONS
                      if (
                        item.id ===
                        'auctions'
                      ) {
                        setAuctionNotifications(
                          0
                        );
                      }
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      page === item.id
                        ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20'
                        : 'text-gray-400 hover:text-white hover:bg-[#111]'
                    }`}
                  >
                    {item.icon}

                    <span className="text-sm font-medium">
                      {item.label}
                    </span>
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </nav>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {page ===
          'attendance' && (
          <AttendancePage
            currentUser={
              currentUser
            }
            members={members}
            onMembersChange={
              loadMembers
            }
          />
        )}

        {page ===
          'auctions' && (
          <AuctionsPage
            currentUser={
              currentUser
            }
            members={members}
            onMembersChange={
              loadMembers
            }
          />
        )}

        {page === 'shop' && (
          <ShopPage
            currentUser={
              currentUser
            }
            onDkpChange={
              refreshDkp
            }
          />
        )}

        {page ===
          'shop-log' &&
          isAdmin && (
            <ShopLogPage />
          )}

        {page ===
          'my-history' && (
            <MyHistoryPage
              buyerId={
                currentUser
                  .member.id
              }
            />
          )}

        {page ===
          'admin' &&
          isAdmin && (
            <AdminPage
              members={members}
              onMembersChange={
                loadMembers
              }
            />
          )}
      </main>
    </div>
  );
}

export default App;
