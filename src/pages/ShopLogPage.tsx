import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';

export function ShopLogPage() {
  const [transactions, setTransactions] = useState<ShopTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'distributed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price-high' | 'price-low'>('newest');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getShopTransactions();
      setTransactions(data);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleDistribute = async (id: number) => {
    try {
      const { data } = await supabase.auth.getSession();
      const username = data.session?.user?.user_metadata?.full_name || 'Admin';
      await distributeTransaction(id, username);
      showToast('Item marked as distributed', 'success');
      loadTransactions();
    } catch (err) {
      showToast('Failed to update distribution status', 'error');
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Transaction ID',
      'Buyer Name',
      'Buyer Discord ID',
      'Item Name',
      'Quantity',
      'Total DKP',
      'Purchase Date',
      'Distribution Status',
      'Distributed By',
      'Distributed At',
    ];

    const rows = filteredTransactions.map((t) => [
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

    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join(
      '\n'
    );

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shop-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('CSV exported successfully', 'success');
  };

  const filteredTransactions = transactions
    .filter((t) => {
      if (statusFilter !== 'all' && t.distribution_status !== statusFilter) return false;
      const searchStr = search.toLowerCase();
      return (
        !search ||
        (t.buyer?.username || '').toLowerCase().includes(searchStr) ||
        (t.item?.name || '').toLowerCase().includes(searchStr)
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

  const pendingCount = transactions.filter((t) => t.distribution_status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.message}
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
            {transactions.length} transactions
            {pendingCount > 0 && (
              <span className="text-yellow-400 ml-2">({pendingCount} pending distribution)</span>
            )}
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="bg-[#222] hover:bg-[#333] text-gray-300 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all text-sm"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by buyer or item..."
            className="w-full pl-10 pr-4 py-2.5 bg-black border border-[#333] rounded-xl text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="pl-10 pr-8 py-2.5 bg-black border border-[#333] rounded-xl text-sm appearance-none cursor-pointer"
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
            className="pl-10 pr-8 py-2.5 bg-black border border-[#333] rounded-xl text-sm appearance-none cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price-high">Price: High to Low</option>
            <option value="price-low">Price: Low to High</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-cyan-400">{transactions.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Orders</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
          <div className="text-xs text-gray-500 mt-1">Pending</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-400">
            {transactions.filter((t) => t.distribution_status === 'distributed').length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Distributed</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">
            {transactions.reduce((sum, t) => sum + t.total_price, 0)} DKP
          </div>
          <div className="text-xs text-gray-500 mt-1">Total Revenue</div>
        </div>
      </div>

      {/* Transactions Table */}
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
              {filteredTransactions.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[#1a1a1a] hover:bg-[#0a0a0a] transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-500" />
                      <span className="font-medium text-sm">
                        {t.buyer?.username || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <ShoppingBag size={14} className="text-cyan-400" />
                      <span className="text-sm">{t.item?.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm">{t.quantity}</td>
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
                      <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                        <CheckCircle2 size={14} />
                        Distributed
                        {t.distributed_by && (
                          <span className="text-gray-500 ml-1">by {t.distributed_by}</span>
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-yellow-400 text-xs font-medium">
                        <AlertTriangle size={14} />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {t.distribution_status === 'pending' ? (
                      <button
                        onClick={() => handleDistribute(t.id)}
                        className="bg-green-600/20 text-green-400 hover:bg-green-600/30 px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-1"
                      >
                        <PackageCheck size={14} />
                        Mark Distributed
                      </button>
                    ) : (
                      <span className="text-gray-600 text-xs">
                        {t.distributed_at
                          ? new Date(t.distributed_at).toLocaleDateString()
                          : 'N/A'}
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
      </div>
    </div>
  );
}
