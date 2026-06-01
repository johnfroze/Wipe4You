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
} from 'lucide-react';

export function ShopLogPage() {
  const [transactions, setTransactions] = useState<ShopTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'distributed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price-high' | 'price-low'>('newest');
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_transactions' }, loadTransactions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTransactions]);

  const handleDistribute = async (id: number) => {
    if (!confirm('Mark this transaction as distributed?')) return;

    try {
      setProcessingId(id);
      const { data } = await supabase.auth.getSession();
      const username = data.session?.user?.user_metadata?.full_name || 'Admin';
      await distributeTransaction(id, username);
      showToast('Item marked as distributed', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update distribution status', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (statusFilter !== 'all' && t.distribution_status !== statusFilter) return false;
        const searchStr = search.toLowerCase();
        return !search || (t.buyer?.username || '').toLowerCase().includes(searchStr) || (t.item?.name || '').toLowerCase().includes(searchStr);
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'oldest': return new Date(a.purchase_timestamp).getTime() - new Date(b.purchase_timestamp).getTime();
          case 'price-high': return b.total_price - a.total_price;
          case 'price-low': return a.total_price - b.total_price;
          default: return new Date(b.purchase_timestamp).getTime() - new Date(a.purchase_timestamp).getTime();
        }
      });
  }, [transactions, search, statusFilter, sortBy]);

  const stats = useMemo(() => ({
    pending: transactions.filter(t => t.distribution_status === 'pending').length,
    distributed: transactions.filter(t => t.distribution_status === 'distributed').length,
    revenue: transactions.reduce((sum, t) => sum + t.total_price, 0),
  }), [transactions]);

  const exportToCSV = () => {
    const headers = ['Transaction ID','Buyer','Item','Quantity','Total DKP','Date','Status'];
    const rows = filteredTransactions.map(t => [t.id,t.buyer?.username || 'Unknown',t.item?.name || 'Unknown',t.quantity,t.total_price,new Date(t.purchase_timestamp).toLocaleString(),t.distribution_status]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shop-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('CSV exported successfully', 'success');
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-cyan-400" /></div>;
  }

  return (
    <div className="animate-fade-in space-y-6">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.message}</div>}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ScrollText className="text-cyan-400" /> Shop Log</h1>
        <button onClick={exportToCSV} className="bg-[#222] px-4 py-2 rounded-xl flex items-center gap-2"><Download size={16}/> Export CSV</button>
      </div>

      <div className="flex gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="flex-1 p-2 rounded-xl bg-black border border-[#333]" />
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)} className="p-2 rounded-xl bg-black border border-[#333]">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="distributed">Distributed</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="card p-4 text-center">{transactions.length}<div>Total</div></div>
        <div className="card p-4 text-center">{stats.pending}<div>Pending</div></div>
        <div className="card p-4 text-center">{stats.distributed}<div>Distributed</div></div>
        <div className="card p-4 text-center">{stats.revenue} DKP<div>Revenue</div></div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <tbody>
            {filteredTransactions.map(t => (
              <tr key={t.id} className="border-b border-[#222]">
                <td className="p-4">{t.buyer?.username}</td>
                <td className="p-4">{t.item?.name}</td>
                <td className="p-4">{t.total_price} DKP</td>
                <td className="p-4">{t.distribution_status}</td>
                <td className="p-4">
                  {t.distribution_status === 'pending' && (
                    <button disabled={processingId===t.id} onClick={()=>handleDistribute(t.id)} className="bg-green-600/20 px-3 py-2 rounded-lg">
                      {processingId===t.id ? 'Processing...' : 'Mark Distributed'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
