import { useState, useEffect, useCallback } from 'react';
import { getMyTransactions, supabase } from '@/lib/supabase';
import type { ShopTransaction } from '@/types';
import {
  Package,
  Clock,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
  Receipt,
} from 'lucide-react';

interface Props {
  buyerId: string;
}

export function MyHistoryPage({ buyerId }: Props) {
  const [transactions, setTransactions] = useState<ShopTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMyTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyTransactions(buyerId);
      setTransactions(data);
    } catch (err) {
      console.error('Failed to load my transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [buyerId]);

  useEffect(() => {
    loadMyTransactions();

    const channel = supabase
      .channel('my-history-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_transactions' }, () => {
        loadMyTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMyTransactions]);

  const totalSpent = transactions.reduce((sum, t) => sum + t.total_price, 0);
  const pendingCount = transactions.filter((t) => t.distribution_status === 'pending').length;
  const distributedCount = transactions.filter(
    (t) => t.distribution_status === 'distributed'
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="text-cyan-400" size={24} />
          My Purchase History
        </h1>
        <p className="text-gray-500 text-sm mt-1">View all your DKP shop purchases</p>
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
          <div className="text-2xl font-bold text-green-400">{distributedCount}</div>
          <div className="text-xs text-gray-500 mt-1">Received</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">{totalSpent} DKP</div>
          <div className="text-xs text-gray-500 mt-1">Total Spent</div>
        </div>
      </div>

      {/* Transactions */}
      {transactions.length === 0 ? (
        <div className="card p-12 text-center">
          <Receipt className="mx-auto text-gray-600 mb-3" size={48} />
          <p className="text-gray-500">No purchases yet</p>
          <p className="text-gray-600 text-sm mt-1">Visit the DKP Shop to buy items</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((t) => (
            <div
              key={t.id}
              className="card p-5 flex flex-col sm:flex-row justify-between gap-4 animate-slide-in"
            >
              <div className="flex items-start gap-4">
                {/* Item Image */}
                <div className="w-16 h-16 bg-black rounded-xl flex items-center justify-center flex-shrink-0 border border-[#222]">
                  {t.item?.image_url ? (
                    <img
                      src={t.item.image_url}
                      alt={t.item?.name || ''}
                      className="w-full h-full object-contain rounded-xl"
                    />
                  ) : (
                    <ShoppingBag className="text-gray-600" size={24} />
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-lg">{t.item?.name || 'Unknown Item'}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Receipt size={12} />
                      {t.quantity}x @ {t.item?.price || 0} DKP
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(t.purchase_timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {t.distribution_status === 'distributed' ? (
                      <span className="flex items-center gap-1 text-green-400 text-xs font-medium bg-green-400/10 px-2 py-1 rounded-lg">
                        <CheckCircle2 size={12} />
                        Distributed
                        {t.distributed_by && (
                          <span className="text-gray-500 ml-1">by {t.distributed_by}</span>
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-yellow-400 text-xs font-medium bg-yellow-400/10 px-2 py-1 rounded-lg">
                        <AlertTriangle size={12} />
                        Pending Distribution
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-cyan-400 text-xl font-bold tabular-nums">
                    {t.total_price} DKP
                  </div>
                  <div className="text-gray-500 text-xs">
                    {new Date(t.purchase_timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
