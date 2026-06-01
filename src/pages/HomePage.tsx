interface Props {
  onLogin: () => void;
}

export default function HomePage({ onLogin }: Props) {
  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-hidden relative">

      {/* ── Background layers ── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,#00d4ff0a,transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,#7c3aed0a,transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,#0f172a,transparent_80%)]" />

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#00d4ff 1px, transparent 1px), linear-gradient(90deg, #00d4ff 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* ── Navbar ── */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-xl bg-[#050508]/60">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-xl">
              🛡️
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wide">
                WIPE<span className="text-cyan-400">4</span>YOU
              </h1>
              <p className="text-[10px] text-gray-600 tracking-widest uppercase -mt-0.5">
                Guild Management System
              </p>
            </div>
          </div>

          <button
            onClick={onLogin}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] transition-all duration-200 text-white font-bold text-sm shadow-[0_0_24px_#5865F233] hover:shadow-[0_0_32px_#5865F244] hover:scale-105"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.013.042.029.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Login with Discord
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-16">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/8 border border-cyan-500/20 text-cyan-400 text-xs font-bold tracking-widest uppercase mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Real-Time Guild System — Online
            </div>

            <h1 className="text-5xl lg:text-6xl font-black leading-[1.05] mb-6 tracking-tight">
              Manage Your
              <span className="block bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Guild Like a Pro
              </span>
            </h1>

            <p className="text-gray-400 text-lg leading-relaxed max-w-lg mb-10">
              DKP tracking, attendance, live auctions, item shop — everything your
              competitive MMORPG guild needs in one dashboard.
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={onLogin}
                className="flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 transition-all duration-200 text-black font-black text-sm tracking-wide uppercase shadow-[0_0_40px_#00d4ff33] hover:shadow-[0_0_60px_#00d4ff55] hover:scale-105"
              >
                Enter Dashboard →
              </button>
              <button className="px-8 py-4 rounded-xl border border-white/10 hover:border-cyan-500/30 bg-white/3 hover:bg-cyan-500/5 transition-all duration-200 font-bold text-sm text-gray-400 hover:text-white">
                View Features
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mt-12">
              {[
                { value: '24/7', label: 'Live Tracking', color: 'text-cyan-400' },
                { value: 'Live', label: 'DKP Updates', color: 'text-purple-400' },
                { value: 'Secure', label: 'Discord Auth', color: 'text-green-400' },
              ].map((stat) => (
                <div key={stat.label} className="card-hud p-4 rounded-2xl text-center corner-accent">
                  <div className={`text-2xl font-black hud-number ${stat.color}`}>{stat.value}</div>
                  <div className="text-gray-500 text-xs mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: dashboard preview */}
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-cyan-500/10 rounded-full scale-75" />
            <div className="relative card-hud rounded-[28px] p-6 shadow-2xl animate-border-pulse">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-base">Guild Overview</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Live statistics</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Online
                </div>
              </div>

              {/* Cards */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: 'Total Members', value: '142', color: 'text-cyan-400' },
                  { label: 'Active Auctions', value: '3', color: 'text-purple-400' },
                ].map((c) => (
                  <div key={c.label} className="p-4 rounded-2xl bg-black/40 border border-white/5">
                    <div className="text-gray-500 text-xs mb-1">{c.label}</div>
                    <div className={`text-3xl font-black hud-number ${c.color}`}>{c.value}</div>
                  </div>
                ))}
              </div>

              {/* Events */}
              <div className="space-y-2.5">
                {[
                  { name: "Sindri's Island", sub: 'Starts in 2 hours', dkp: '+20 DKP', color: 'text-cyan-400' },
                  { name: 'Server Battle', sub: 'Weekly event', dkp: '+30 DKP', color: 'text-purple-400' },
                  { name: 'Guild Dungeon', sub: 'Progression run', dkp: '+10 DKP', color: 'text-green-400' },
                ].map((e) => (
                  <div key={e.name} className="flex items-center justify-between p-3.5 rounded-xl bg-black/30 border border-white/5">
                    <div>
                      <div className="font-semibold text-sm">{e.name}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{e.sub}</div>
                    </div>
                    <div className={`font-black text-sm hud-number ${e.color}`}>{e.dkp}</div>
                  </div>
                ))}
              </div>

              {/* Bottom bar */}
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-600">
                <span>Top DKP holder</span>
                <span className="text-cyan-400 font-bold">PlayerOne — 4,820 DKP</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
        <div className="hud-divider mb-12" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: '⚔️', title: 'DKP Tracking', desc: 'Real-time point management with decay and history' },
            { icon: '🏆', title: 'Live Auctions', desc: 'Anti-snipe bidding system with countdown timers' },
            { icon: '🛒', title: 'Item Shop', desc: 'Atomic stock control — no overselling ever' },
            { icon: '📊', title: 'Attendance', desc: 'Event-by-event history for every guild member' },
          ].map((f) => (
            <div key={f.title} className="card p-5 hover:border-[#1e2d3d] transition-all group">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-sm mb-1 group-hover:text-cyan-400 transition-colors">{f.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
