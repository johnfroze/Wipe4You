import { useState, useEffect, useCallback, useMemo } from 'react';
import { getShopTransactions, distributeTransaction, supabase } from '@/lib/supabase';
import type { ShopTransaction } from '@/types';
import {
  ScrollText,
  Search,
  Filter,
  Download,
  PackageCheck,
  Clock,
  User,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Package,
  X,
  Loader2,
  Trash2,
  CheckCheck,
} from 'lucide-react';

interface BuyerAggregate {
  buyerId: string;
  username: string;
  discordId: string;
  totalOrders: number;
  totalItems: number;
  totalSpent: number;
  itemsBreakdown: {
    itemName: string;
    itemId: number;
    quantity: number;
    totalCost: number;
  }[];
}

// ─── Confirmation Modal ───
function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmClass,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-gray-400">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm bg-[#222] hover:bg-[#333] text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors disabled:opacity-50 ${confirmClass}`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShopLogPage() {
  const [transactions, setTransactions] = useState<ShopTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showBuyerSummary, setShowBuyerSummary] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  // Modal state
  const [modal, setModal] = useState<'reset' | 'markAll' | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'distributed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price-high' | 'price-low'>('newest');

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getShopTransactions();
      setTransactions(data);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      showToast('Failed to load transactions', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTransactions();

    const channel = supabase
      .channel('shop-log-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_transactions' }, () => {
        loadTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTransactions]);

  // ─── Handle Single Distribution ───
  const handleDistribute = useCallback(
    async (id: number) => {
      try {
        setActionLoading(id);
        const { data } = await supabase.auth.getSession();
        const username = data.session?.user?.user_metadata?.full_name || 'Admin';
        await distributeTransaction(id, username);
        showToast('Item marked as distributed', 'success');
        await loadTransactions();
      } catch {
        showToast('Failed to update distribution status', 'error');
      } finally {
        setActionLoading(null);
      }
    },
    [loadTransactions, showToast]
  );

  // ─── Mark All Pending as Distributed ───
  const handleMarkAllDistributed = useCallback(async () => {
    try {
      setBulkLoading(true);
      const { data } = await supabase.auth.getSession();
      const username = data.session?.user?.user_metadata?.full_name || 'Admin';

      const pending = transactions.filter((t) => t.distribution_status === 'pending');
      await Promise.all(pending.map((t) => distributeTransaction(t.id, username)));

      showToast(`${pending.length} transaction${pending.length !== 1 ? 's' : ''} marked as distributed`, 'success');
      await loadTransactions();
    } catch {
      showToast('Failed to bulk distribute', 'error');
    } finally {
      setBulkLoading(false);
      setModal(null);
    }
  }, [transactions, loadTransactions, showToast]);

  // ─── Reset Shop Log ───
  const handleResetShopLog = useCallback(async () => {
    try {
      setResetLoading(true);
      const { error } = await supabase
        .from('shop_transactions')
        .delete()
        .neq('id', 0); // deletes all rows

      if (error) throw error;

      showToast('Shop log has been reset', 'success');
      await loadTransactions();
    } catch {
      showToast('Failed to reset shop log', 'error');
    } finally {
      setResetLoading(false);
      setModal(null);
    }
  }, [loadTransactions, showToast]);

  // ─── Filtered & Sorted Transactions ───
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (statusFilter !== 'all' && t.distribution_status !== statusFilter) return false;
        const searchStr = search.toLowerCase();
        return (
          !search ||
          (t.buyer?.username || '').toLowerCase().includes(searchStr) ||
          (t.item?.name || '').toLowerCase().includes(searchStr) ||
          (t.buyer?.discord_id || '').toLowerCase().includes(searchStr)
        );
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'oldest':
            return new Date(a.purchase_timestamp).getTime() - new Date(b.purchase_timestamp).getTime();
          case 'price-high':
            return b.total_price - a.total_price;
          case 'price-low':
            return a.total_price - b.total_price;
          default:
            return new Date(b.purchase_timestamp).getTime() - new Date(a.purchase_timestamp).getTime();
        }
      });
  }, [transactions, statusFilter, search, sortBy]);

  // ─── Buyer Aggregation ───
  const buyerAggregates: BuyerAggregate[] = useMemo(() => {
    const map = new Map<string, BuyerAggregate>();

    transactions.forEach((t) => {
      const buyerId = t.buyer_id || t.buyer?.id || 'unknown';
      const existing = map.get(buyerId);

      const itemBreakdown = {
        itemName: t.item?.name || 'Unknown',
        itemId: t.item_id,
        quantity: t.quantity,
        totalCost: t.total_price,
      };

      if (existing) {
        existing.totalOrders += 1;
        existing.totalItems += t.quantity;
        existing.totalSpent += t.total_price;

        const existingItem = existing.itemsBreakdown.find((i) => i.itemId === t.item_id);
        if (existingItem) {
          existingItem.quantity += t.quantity;
          existingItem.totalCost += t.total_price;
        } else {
          existing.itemsBreakdown.push(itemBreakdown);
        }
      } else {
        map.set(buyerId, {
          buyerId,
          username: t.buyer?.username || 'Unknown',
          discordId: t.buyer?.discord_id || '',
          totalOrders: 1,
          totalItems: t.quantity,
          totalSpent: t.total_price,
          itemsBreakdown: [itemBreakdown],
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalItems - a.totalItems);
  }, [transactions]);

  // ─── Stats ───
  const stats = useMemo(() => {
    const pending = transactions.filter((t) => t.distribution_status === 'pending');
    return {
      total: transactions.length,
      pending: pending.length,
      distributed: transactions.filter((t) => t.distribution_status === 'distributed').length,
      revenue: transactions.reduce((sum, t) => sum + t.total_price, 0),
      pendingRevenue: pending.reduce((sum, t) => sum + t.total_price, 0),
    };
  }, [transactions]);

  // Reset to page 1 whenever filters change
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, safePage, PAGE_SIZE]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, sortBy]);

  // ─── CSV Export ───
  const exportToCSV = useCallback(() => {
    const txHeaders = [
      'Transaction ID', 'Buyer Name', 'Buyer Discord ID', 'Item Name',
      'Quantity', 'Total DKP', 'Purchase Date', 'Distribution Status',
      'Distributed By', 'Distributed At',
    ];

    const txRows = filteredTransactions.map((t) => [
      t.id,
      t.buyer?.username || 'Unknown',
      t.buyer?.discord_id || '',
      t.item?.name || 'Unknown',
      t.quantity,
      t.total_price,
      new Date(t.purchase_timestamp).toLocaleString(),
      t.distribution_status,
      t.distributed_by || '',
      t.distributed_at ? new Date(t.distributed_at).toLocaleString() : '',
    ]);

    const buyerHeaders = ['Buyer Name', 'Discord ID', 'Total Orders', 'Total Items', 'Total Spent (DKP)'];
    const buyerRows = buyerAggregates.map((b) => [
      b.username, b.discordId, b.totalOrders, b.totalItems, b.totalSpent,
    ]);

    const csv = [
      '=== TRANSACTIONS ===',
      txHeaders.join(','),
      ...txRows.map((r) => r.map((c) => `"${c}"`).join(',')),
      '',
      '=== BUYER SUMMARY ===',
      buyerHeaders.join(','),
      ...buyerRows.map((r) => r.map((c) => `"${c}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shop-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('CSV exported successfully', 'success');
  }, [filteredTransactions, buyerAggregates, showToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Confirmation Modals */}
      {modal === 'markAll' && (
        <ConfirmModal
          title="Mark All as Distributed"
          message={`This will mark all ${stats.pending} pending transaction${stats.pending !== 1 ? 's' : ''} as distributed. This cannot be undone.`}
          confirmLabel="Mark All Distributed"
          confirmClass="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/20"
          onConfirm={handleMarkAllDistributed}
          onCancel={() => setModal(null)}
          loading={bulkLoading}
        />
      )}

      {modal === 'reset' && (
        <ConfirmModal
          title="Reset Shop Log"
          message="This will permanently delete all shop transactions. This action cannot be undone. Consider exporting a CSV first."
          confirmLabel="Reset Shop Log"
          confirmClass="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20"
          onConfirm={handleResetShopLog}
          onCancel={() => setModal(null)}
          loading={resetLoading}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="text-cyan-400" size={24} />
            Shop Log
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {stats.total} transactions
            {stats.pending > 0 && (
              <span className="text-yellow-400 ml-2">({stats.pending} pending distribution)</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Buyer Summary */}
          <button
            onClick={() => setShowBuyerSummary(!showBuyerSummary)}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm ${
              showBuyerSummary
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-[#222] hover:bg-[#333] text-gray-300 border border-transparent'
            }`}
          >
            <TrendingUp size={16} />
            Buyer Summary
          </button>

          {/* Mark All Distributed */}
          <button
            onClick={() => setModal('markAll')}
            disabled={stats.pending === 0 || bulkLoading}
            className="bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm"
          >
            <CheckCheck size={16} />
            Mark All Distributed
            {stats.pending > 0 && (
              <span className="bg-green-500/20 text-green-300 text-xs px-1.5 py-0.5 rounded-full">
                {stats.pending}
              </span>
            )}
          </button>

          {/* Export CSV */}
          <button
            onClick={exportToCSV}
            className="bg-[#222] hover:bg-[#333] text-gray-300 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm"
          >
            <Download size={16} />
            Export CSV
          </button>

          {/* Reset Shop Log */}
          <button
            onClick={() => setModal('reset')}
            disabled={transactions.length === 0 || resetLoading}
            className="bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm"
          >
            <Trash2 size={16} />
            Reset Log
          </button>
        </div>
      </div>

      {/* Buyer Summary Panel — unchanged */}
      {showBuyerSummary && (
        <div className="card overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-[#222] flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <User className="text-cyan-400" size={16} />
              Buyer Summary — Total Items per Person
            </h2>
            <span className="text-xs text-gray-500">{buyerAggregates.length} buyers</span>
          </div>

          {buyerAggregates.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No buyer data available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222] text-left text-xs text-gray-500 uppercase">
                    <th className="p-3">Rank</th>
                    <th className="p-3">Buyer</th>
                    <th className="p-3">Orders</th>
                    <th className="p-3">Total Items</th>
                    <th className="p-3">Total Spent</th>
                    <th className="p-3">Items Breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  {buyerAggregates.map((buyer, idx) => (
                    <BuyerSummaryRow key={buyer.buyerId} buyer={buyer} rank={idx + 1} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Filters — unchanged */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by buyer, item, or Discord ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-black border border-[#333] rounded-xl text-sm focus:border-cyan-500/50 focus:outline-none transition-colors"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="pl-10 pr-8 py-2.5 bg-black border border-[#333] rounded-xl text-sm appearance-none cursor-pointer focus:border-cyan-500/50 focus:outline-none transition-colors"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="distributed">Distributed</option>
          </select>
        </div>
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="pl-10 pr-8 py-2.5 bg-black border border-[#333] rounded-xl text-sm appearance-none cursor-pointer focus:border-cyan-500/50 focus:outline-none transition-colors"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price-high">Price: High to Low</option>
            <option value="price-low">Price: Low to High</option>
          </select>
        </div>
      </div>

      {/* Stats — unchanged */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-cyan-400">{stats.total}</div>
          <div className="text-xs text-gray-500 mt-1">Total Orders</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
          <div className="text-xs text-gray-500 mt-1">Pending</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{stats.distributed}</div>
          <div className="text-xs text-gray-500 mt-1">Distributed</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">{stats.revenue}</div>
          <div className="text-xs text-gray-500 mt-1">Total Revenue</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">{stats.pendingRevenue}</div>
          <div className="text-xs text-gray-500 mt-1">Pending Revenue</div>
        </div>
      </div>

      {/* Transactions Table — unchanged */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#222] text-left text-xs text-gray-500 uppercase">
                <th className="p-4">Buyer</th>
                <th className="p-4">Item</th>
                <th className="p-4">Qty</th>
                <th className="p-4">Total</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((t) => (
                <tr key={t.id} className="border-b border-[#1a1a1a] hover:bg-[#0a0a0a] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#222] flex items-center justify-center">
                        <User size={14} className="text-gray-400" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{t.buyer?.username || 'Unknown'}</div>
                        {t.buyer?.discord_id && (
                          <div className="text-[10px] text-gray-600">{t.buyer.discord_id}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <ShoppingBag size={14} className="text-cyan-400" />
                      <span className="text-sm">{t.item?.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm">
                    <span className="bg-[#1a1a1a] px-2 py-1 rounded-md text-xs font-medium">
                      {t.quantity}x
                    </span>
                  </td>
                  <td className="p-4 text-cyan-400 font-medium text-sm tabular-nums">
                    {t.total_price} DKP
                  </td>
                  <td className="p-4 text-gray-500 text-xs">
                    {new Date(t.purchase_timestamp).toLocaleDateString()}
                    <br />
                    {new Date(t.purchase_timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-4">
                    {t.distribution_status === 'distributed' ? (
                      <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
                        <CheckCircle2 size={14} />
                        Distributed
                        {t.distributed_by && (
                          <span className="text-gray-500 ml-1">by {t.distributed_by}</span>
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-yellow-400 text-xs font-medium">
                        <AlertTriangle size={14} />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {t.distribution_status === 'pending' ? (
                      <button
                        onClick={() => handleDistribute(t.id)}
                        disabled={actionLoading === t.id}
                        className="bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-1.5"
                      >
                        {actionLoading === t.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <PackageCheck size={14} />
                        )}
                        Mark Distributed
                      </button>
                    ) : (
                      <span className="text-gray-600 text-xs">
                        {t.distributed_at ? new Date(t.distributed_at).toLocaleDateString() : 'N/A'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="p-12 text-center">
            <ScrollText className="mx-auto text-gray-600 mb-3" size={48} />
            <p className="text-gray-500">
              {search || statusFilter !== 'all'
                ? 'No transactions match your filters'
                : 'No transactions yet'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {filteredTransactions.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e2d3d]">
            <span className="text-xs text-gray-600">
              Showing {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filteredTransactions.length)} of {filteredTransactions.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                className="page-btn"
                onClick={() => setCurrentPage(1)}
                disabled={safePage === 1}
              >«</button>
              <button
                className="page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >‹</button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
                const page = start + i;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`page-btn ${safePage === page ? 'active' : ''}`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                className="page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >›</button>
              <button
                className="page-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage === totalPages}
              >»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BuyerSummaryRow — unchanged ───
function BuyerSummaryRow({ buyer, rank }: { buyer: BuyerAggregate; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  const getRankColor = (r: number) => {
    if (r === 1) return 'text-yellow-400';
    if (r === 2) return 'text-gray-300';
    if (r === 3) return 'text-orange-400';
    return 'text-gray-500';
  };

  return (
    <>
      <tr
        className="border-b border-[#1a1a1a] hover:bg-[#0a0a0a] transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="p-3">
          <span className={`text-sm font-bold ${getRankColor(rank)}`}>#{rank}</span>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#222] flex items-center justify-center">
              <User size={14} className="text-gray-400" />
            </div>
            <div>
              <div className="font-medium text-sm">{buyer.username}</div>
              {buyer.discordId && <div className="text-[10px] text-gray-600">{buyer.discordId}</div>}
            </div>
          </div>
        </td>
        <td className="p-3 text-sm text-gray-400">{buyer.totalOrders}</td>
        <td className="p-3">
          <span className="text-sm font-bold text-cyan-400">{buyer.totalItems}</span>
        </td>
        <td className="p-3 text-sm text-purple-400 font-medium tabular-nums">{buyer.totalSpent} DKP</td>
        <td className="p-3">
          <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {buyer.itemsBreakdown.length} item type{buyer.itemsBreakdown.length > 1 ? 's' : ''}
          </button>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="bg-[#080808] px-4 py-3 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {buyer.itemsBreakdown.map((item) => (
                  <div
                    key={item.itemId}
                    className="flex items-center justify-between bg-[#111] rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Package size={12} className="text-cyan-400" />
                      <span className="text-xs text-gray-300">{item.itemName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-cyan-400 font-medium">{item.quantity}x</span>
                      <span className="text-xs text-gray-500">{item.totalCost} DKP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
