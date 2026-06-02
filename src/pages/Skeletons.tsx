// ─── Skeleton primitives ─────────────────────────────────
// Usage: <SkeletonLine /> <SkeletonCard> ... </SkeletonCard>

interface SkeletonProps {
  className?: string;
}

export function SkeletonLine({ className = '' }: SkeletonProps) {
  return (
    <div className={`skeleton-line ${className}`} />
  );
}

export function SkeletonBlock({ className = '' }: SkeletonProps) {
  return (
    <div className={`skeleton-block ${className}`} />
  );
}

// ─── Leaderboard row skeleton ─────────────────────────────
export function SkeletonMemberRow() {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-[#1a2234] gap-4">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="w-8 h-8 rounded-full" />
        <SkeletonBlock className="w-10 h-10 rounded-full" />
        <div className="space-y-2">
          <SkeletonLine className="w-24 h-3" />
          <SkeletonLine className="w-14 h-2" />
        </div>
      </div>
      <div className="hidden sm:flex flex-col gap-1.5 flex-1 max-w-xs px-6">
        <SkeletonLine className="w-full h-1.5 rounded-full" />
      </div>
      <SkeletonLine className="w-20 h-5" />
    </div>
  );
}

// ─── Shop item card skeleton ──────────────────────────────
export function SkeletonShopCard() {
  return (
    <div className="card overflow-hidden">
      <SkeletonBlock className="h-48 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <SkeletonLine className="w-3/4 h-4" />
        <SkeletonLine className="w-1/2 h-6" />
        <SkeletonLine className="w-full h-1.5 rounded-full" />
        <SkeletonBlock className="w-full h-10 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Auction card skeleton ────────────────────────────────
export function SkeletonAuctionCard() {
  return (
    <div className="card overflow-hidden">
      <SkeletonBlock className="h-52 w-full rounded-none" />
      <div className="p-5 space-y-4">
        <div className="flex justify-between">
          <SkeletonLine className="w-1/2 h-5" />
          <SkeletonLine className="w-20 h-8 rounded-xl" />
        </div>
        <SkeletonBlock className="w-full h-16 rounded-xl" />
        <SkeletonLine className="w-full h-10 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Table row skeleton ───────────────────────────────────
export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-b border-[#0f1923]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonLine className={`h-3 ${i === 0 ? 'w-24' : i === cols - 1 ? 'w-16' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  );
}

// ─── Announcement skeleton ────────────────────────────────
export function SkeletonAnnouncement() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex justify-between">
        <div className="space-y-2">
          <SkeletonLine className="w-48 h-4" />
          <SkeletonLine className="w-32 h-2.5" />
        </div>
        <SkeletonBlock className="w-16 h-8 rounded-xl" />
      </div>
      <SkeletonLine className="w-full h-3" />
      <SkeletonLine className="w-4/5 h-3" />
      <SkeletonLine className="w-2/3 h-3" />
    </div>
  );
}

// ─── Stats bar skeleton ───────────────────────────────────
export function SkeletonStats({ count = 5 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-${count} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-hud rounded-xl p-4 text-center space-y-2">
          <SkeletonLine className="w-12 h-7 mx-auto" />
          <SkeletonLine className="w-16 h-2.5 mx-auto" />
        </div>
      ))}
    </div>
  );
}
