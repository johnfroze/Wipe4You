import { useState, useEffect, useCallback, useMemo } from 'react';
import { getShopTransactions, distributeTransaction, supabase } from '@/lib/supabase';
import type { ShopTransaction } from '@/types';
import { ScrollText, Download } from 'lucide-react';

export function ShopLogPage() {
  const [transactions, setTransactions] = useState<ShopTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'distributed'>('all');

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

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
      console.error(err);
      showToast('Failed to load transactions', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();

    const channel = supabase
      .channel('shop-log-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shop_transactions',
        },
        loadTransactions
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTransactions]);

  const handleDistribute = async (id: number) => {
    const confirmed = window.confirm(
      'Are you sure you want to mark this as distributed?'
    );

    if (!confirmed) return;

    try {
      setProcessingId(id);

      const { data } = await supabase.auth.getSession();
      const username =
        data.session?.user?.user_metadata?.full_name || 'Admin';

      await distributeTransaction(id, username);

      showToast('Transaction marked as distributed', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to distribute transaction', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesStatus =
        statusFilter === 'all' ||
        t.distribution_status === statusFilter;

      const searchLower = search.toLowerCase();

      const matchesSearch =
        !search ||
        (t.buyer?.username || '')
          .toLowerCase()
          .includes(searchLower) ||
        (t.item?.name || '')
          .toLowerCase()
          .includes(searchLower);

      return matchesStatus && matchesSearch;
    });
  }, [transactions, search, statusFilter]);

  const stats = useMemo(() => {
    const pending = transactions.filter(
      (t) => t.distribution_status === 'pending'
    ).length;

    const distributed = transactions.filter(
      (t) => t.distribution_status === 'distributed'
    ).length;

    const revenue = transactions.reduce(
      (sum, t) => sum + t.total_price,
      0
    );

    return {
      pending,
      distributed,
      revenue,
    };
  }, [transactions]);

  const exportToCSV = () => {
    const headers = [
      'ID',
      'Buyer',
      'Item',
      'Quantity',
      'Total DKP',
      'Status',
      'Date',
    ];

    const rows = filteredTransactions.map((t) => [
      t.id,
      t.buyer?.username || 'Unknown',
      t.item?.name || 'Unknown',
      t.quantity,
      t.total_price,
      t.distribution_status,
      new Date(t.purchase_timestamp).toLocaleString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) =>
            `"${String(cell).replace(/"/g, '""')}"`
          )
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shop-log-${new Date()
      .toISOString()
      .split('T')[0]}.csv`;

    link.click();

    URL.revokeObjectURL(link.href);

    showToast('CSV exported successfully', 'success');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`p-3 rounded-xl ${
            toast.type === 'success'
              ? 'bg-green-600/20 text-green-400'
              : 'bg-red-600/20 text-red-400'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="text-cyan-400" />
          Shop Log
        </h1>

        <button
          onClick={exportToCSV}
          className="bg-[#222] px-4 py-2 rounded-xl flex items-center gap-2"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="flex gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search buyer or item..."
          className="flex-1 p-2 rounded-xl bg-black border border-[#333]"
        />

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as 'all' | 'pending' | 'distributed'
            )
          }
          className="p-2 rounded-xl bg-black border border-[#333]"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="distributed">Distributed</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          {transactions.length}
          <div>Total Orders</div>
        </div>

        <div className="card p-4 text-center">
          {stats.pending}
          <div>Pending</div>
        </div>

        <div className="card p-4 text-center">
          {stats.distributed}
          <div>Distributed</div>
        </div>

        <div className="card p-4 text-center">
          {stats.revenue} DKP
          <div>Revenue</div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#222]">
              <th className="p-4 text-left">Buyer</th>
              <th className="p-4 text-left">Item</th>
              <th className="p-4 text-left">Qty</th>
              <th className="p-4 text-left">Total</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredTransactions.map((t) => (
              <tr key={t.id} className="border-b border-[#222]">
                <td className="p-4">
                  {t.buyer?.username || 'Unknown'}
                </td>

                <td className="p-4">
                  {t.item?.name || 'Unknown'}
                </td>

                <td className="p-4">{t.quantity}</td>

                <td className="p-4">
                  {t.total_price} DKP
                </td>

                <td className="p-4">
                  {t.distribution_status}
                </td>

                <td className="p-4">
                  {t.distribution_status === 'pending' ? (
                    <button
                      onClick={() =>
                        handleDistribute(t.id)
                      }
                      disabled={processingId === t.id}
                      className="bg-green-600/20 px-3 py-2 rounded-lg"
                    >
                      {processingId === t.id
                        ? 'Processing...'
                        : 'Mark Distributed'}
                    </button>
                  ) : (
                    'Done'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredTransactions.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            No transactions found
          </div>
        )}
      </div>
    </div>
  );
}
