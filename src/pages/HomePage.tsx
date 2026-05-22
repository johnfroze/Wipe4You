interface Props {
  onLogin: () => void;
}

export default function HomePage({
  onLogin,
}: Props) {
  const features = [
    {
      title: 'Attendance Tracking',
      desc: 'Track raids, guild events, and automatically reward DKP to active members.',
      icon: '📅',
    },
    {
      title: 'Live Auctions',
      desc: 'Run real-time guild auctions with instant bid updates and countdown timers.',
      icon: '⚔️',
    },
    {
      title: 'DKP Shop',
      desc: 'Spend DKP on guild rewards, items, and exclusive loot.',
      icon: '🛒',
    },
    {
      title: 'Guild Rankings',
      desc: 'Compete on the leaderboard and show your dedication to the guild.',
      icon: '👑',
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#00d9ff22,transparent_45%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,#8b5cf622,transparent_40%)]" />

      {/* Navbar */}
      <header className="relative z-10 border-b border-white/10 backdrop-blur-xl bg-black/40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 text-xl">
              🛡️
            </div>

            <div>
              <h1 className="text-xl font-bold">
                Wipe4You
              </h1>

              <p className="text-xs text-gray-400">
                Guild Management Dashboard
              </p>
            </div>
          </div>

          {/* FIXED LOGIN BUTTON */}
          <button
            onClick={onLogin}
            className="px-5 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 transition-all duration-300 text-black font-bold shadow-[0_0_30px_rgba(34,211,238,0.35)]"
          >
            Discord Login
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm mb-6">
              ⚡ Real-Time Guild Dashboard
            </div>

            <h1 className="text-5xl lg:text-7xl font-black leading-tight mb-6">
              Manage Your
              <span className="block text-cyan-400">
                Guild Like a Pro
              </span>
            </h1>

            <p className="text-gray-400 text-lg leading-relaxed max-w-xl mb-8">
              Powerful DKP tracking, attendance management, auctions,
              purchases, and live guild systems built for competitive MMORPG
              communities.
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={onLogin}
                className="px-7 py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 transition-all duration-300 text-black font-bold shadow-[0_0_40px_rgba(34,211,238,0.35)] hover:scale-105"
              >
                Enter Dashboard
              </button>

              <button className="px-7 py-4 rounded-2xl border border-white/10 hover:border-cyan-500/40 bg-white/5 hover:bg-cyan-500/10 transition-all duration-300 font-medium">
                View Features
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-12">
              <div className="p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
                <div className="text-3xl font-black text-cyan-400">
                  24/7
                </div>

                <div className="text-gray-400 text-sm mt-1">
                  Live Tracking
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
                <div className="text-3xl font-black text-purple-400">
                  Realtime
                </div>

                <div className="text-gray-400 text-sm mt-1">
                  DKP Updates
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
                <div className="text-3xl font-black text-green-400">
                  Secure
                </div>

                <div className="text-gray-400 text-sm mt-1">
                  Discord Auth
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-cyan-500/20 rounded-full" />

            <div className="relative bg-white/5 border border-white/10 rounded-[32px] p-6 backdrop-blur-2xl shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold">
                    Guild Overview
                  </h3>

                  <p className="text-gray-400 text-sm">
                    Live guild statistics
                  </p>
                </div>

                <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm border border-green-500/20">
                  Online
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-5 rounded-2xl bg-black/40 border border-white/5">
                  <div className="text-gray-400 text-sm mb-2">
                    Total Members
                  </div>

                  <div className="text-4xl font-black text-cyan-400">
                    142
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-black/40 border border-white/5">
                  <div className="text-gray-400 text-sm mb-2">
                    Active Events
                  </div>

                  <div className="text-4xl font-black text-purple-400">
                    12
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      Sindri's Island
                    </div>

                    <div className="text-gray-400 text-sm">
                      Starts in 2 hours
                    </div>
                  </div>

                  <div className="text-cyan-400 font-bold">
                    +20 DKP
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      Server Battle
                    </div>

                    <div className="text-gray-400 text-sm">
                      Weekly competitive event
                    </div>
                  </div>

                  <div className="text-purple-400 font-bold">
                    +30 DKP
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      Guild Dungeon
                    </div>

                    <div className="text-gray-400 text-sm">
                      Weekly progression run
                    </div>
                  </div>

                  <div className="text-green-400 font-bold">
                    +10 DKP
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
