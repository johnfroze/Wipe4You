import { useState, useEffect, useCallback } from 'react';
import { getMyTransactions, supabase } from '@/lib/supabase';
import type { ShopTransaction } from '@/types';
import {
  Package, Clock, ShoppingBag, AlertTriangle,
  CheckCircle2, Receipt, Zap,
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [buyerId]);

  useEffect(() => {
    loadMyTransactions();
    const channel = supabase
      .channel('my-history-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_transactions' }, loadMyTransactions)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMyTransactions]);

  const totalSpent = transactions.reduce((sum, t) => sum + t.total_price, 0);
  const pendingCount = transactions.filter((t) => t.distribution_status === 'pending').length;
  const distributedCount = transactions.filter((t) => t.distribution_status === 'distributed').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-[#1e2d3d] animate-spin border-t-cyan-400" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2.5 tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
            <Package size={16} className="text-cyan-400" />
          </div>
          My Purchases
        </h1>
        <p className="text-gray-500 text-sm mt-1">Your complete DKP shop history</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { value: transactions.length, label: 'Total Orders', color: 'text-cyan-400' },
          { value: pendingCount, label: 'Pending', color: 'text-yellow-400' },
          { value: distributedCount, label: 'Received', color: 'text-green-400' },
          { value: `${totalSpent.toLocaleString()}`, label: 'Total Spent', color: 'text-purple-400', suffix: ' DKP' },
        ].map((s) => (
          <div key={s.label} className="card-hud rounded-xl p-4 text-center corner-accent">
            <div className={`text-2xl font-black hud-number ${s.color}`}>
              {s.value}{s.suffix || ''}
            </div>
            <div className="text-xs text-gray-600 mt-1 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Empty */}
      {transactions.length === 0 ? (
        <div className="card p-16 text-center">
          <Receipt size={48} className="mx-auto text-gray-700 mb-4" />
          <p className="text-gray-500 font-medium">No purchases yet</p>
          <p className="text-gray-600 text-sm mt-1">Visit the DKP Shop to spend your points</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((t) => (
            <div key={t.id} className="card p-5 flex flex-col sm:flex-row justify-between gap-4 hover:border-[#1e2d3d] transition-colors animate-slide-in">
              {/* Left */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-black/60 rounded-xl flex items-center justify-center shrink-0 border border-[#1e2d3d]">
                  {t.item?.image_url ? (
                    <img src={t.item.image_url} alt={t.item?.name || ''} className="w-full h-full object-contain rounded-xl" />
                  ) : (
                    <ShoppingBag size={22} className="text-gray-700" />
                  )}
                </div>

                <div>
                  <h3 className="font-black text-base">{t.item?.name || 'Unknown Item'}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Receipt size={11} />
                      {t.quantity}x @ {(t.item?.price || 0).toLocaleString()} DKP
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(t.purchase_timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-2">
                    {t.distribution_status === 'distributed' ? (
                      <span className="inline-flex items-center gap-1.5 text-green-400 text-xs font-bold bg-green-400/8 px-2.5 py-1 rounded-lg border border-green-400/15">
                        <CheckCircle2 size={11} />
                        Received
                        {t.distributed_by && <span className="text-green-600 font-normal">by {t.distributed_by}</span>}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-yellow-400 text-xs font-bold bg-yellow-400/8 px-2.5 py-1 rounded-lg border border-yellow-400/15">
                        <AlertTriangle size={11} />
                        Pending Delivery
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:justify-center">
                <div className="flex items-center gap-1.5 text-cyan-400 font-black text-xl hud-number tabular-nums">
                  <Zap size={14} />
                  {t.total_price.toLocaleString()} DKP
                </div>
                <div className="text-gray-600 text-xs">
                  {new Date(t.purchase_timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
