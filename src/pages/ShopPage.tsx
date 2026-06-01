import { useState, useEffect, useCallback } from 'react';
import { getShopItems, uploadShopImage, supabase } from '@/lib/supabase';
import type { CurrentUser, ShopItem } from '@/types';
import {
  ShoppingBag, Plus, Package, Search, Filter,
  X, CheckCircle2, AlertTriangle, Pencil, Trash2,
  Loader2, Lock, ShieldAlert,
} from 'lucide-react';

interface Props {
  currentUser: CurrentUser | null;
  onDkpChange: () => void;
}

// ─── Toast ───
function Toast({
  message, type, onClose,
}: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium
      ${type === 'success'
        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
        : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {message}
      <button onClick={onClose} className="ml-2 hover:text-white"><X size={14} /></button>
    </div>
  );
}

// ─── Confirm Modal ───
function ConfirmModal({
  title, message, confirmLabel,
  confirmClass = 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-600/30',
  onConfirm, onCancel, loading = false,
}: {
  title: string; message: string; confirmLabel: string;
  confirmClass?: string; onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-gray-400">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-xl text-sm bg-[#222] hover:bg-[#333] text-gray-300 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors disabled:opacity-50 ${confirmClass}`}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Item Modal ───
function EditItemModal({
  item, onSave, onCancel,
}: {
  item: ShopItem;
  onSave: (updates: { name: string; price: number; current_stock: number; total_stock: number; image_url: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [stock, setStock] = useState(String(item.current_stock));
  const [totalStock, setTotalStock] = useState(String(item.total_stock));
  const [imageUrl, setImageUrl] = useState(item.image_url || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !price || !stock) return;
    setSaving(true);
    await onSave({
      name,
      price: parseInt(price),
      current_stock: parseInt(stock),
      total_stock: parseInt(totalStock) || parseInt(stock),
      image_url: imageUrl,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Pencil size={16} className="text-cyan-400" /> Edit Item
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Item Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-cyan-500/50 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Price (DKP)</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} type="number"
                className="w-full bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-cyan-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Current Stock</label>
              <input value={stock} onChange={(e) => setStock(e.target.value)} type="number"
                className="w-full bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-cyan-500/50 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Total Stock</label>
            <input value={totalStock} onChange={(e) => setTotalStock(e.target.value)} type="number"
              className="w-full bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-cyan-500/50 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Image URL (optional)</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..."
              className="w-full bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-cyan-500/50 focus:outline-none" />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-2 rounded-xl text-sm bg-[#222] hover:bg-[#333] text-gray-300">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-xl text-sm bg-cyan-600/20 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-600/30 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShopPage({ currentUser, onDkpChange }: Props) {
  const isAdmin =
    currentUser?.member.role === 'leader' ||
    currentUser?.member.role === 'elder';

  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [shopEnabled, setShopEnabled] = useState(true);
  const [localDkp, setLocalDkp] = useState(currentUser?.member.dkp || 0);

  // Filters
  const [search, setSearch] = useState('');
  const [showInStockOnly, setShowInStockOnly] = useState(false);

  // Add item
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemStock, setItemStock] = useState('');
  const [itemImage, setItemImage] = useState<File | null>(null);
  const [addingItem, setAddingItem] = useState(false);

  // Modals
  const [confirmBuy, setConfirmBuy] = useState<ShopItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShopItem | null>(null);
  const [editItem, setEditItem] = useState<ShopItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadShopSettings = useCallback(async () => {
    const { data } = await supabase
      .from('shop_settings')
      .select('shop_enabled')
      .limit(1)
      .single();
    if (data) setShopEnabled(data.shop_enabled);
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const data = await getShopItems();
      setItems(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadItems(), loadShopSettings()]).finally(() => setLoading(false));

    const itemsChannel = supabase
      .channel('shop-items-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_items' }, loadItems)
      .subscribe();

    const settingsChannel = supabase
      .channel('shop-settings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_settings' }, loadShopSettings)
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, [loadItems, loadShopSettings]);

  useEffect(() => {
    setLocalDkp(currentUser?.member.dkp || 0);
  }, [currentUser]);

  // ─── BUY ITEM — atomic via Postgres RPC ───
  const executeBuy = async (item: ShopItem) => {
    if (!currentUser) return;
    setBuyingId(item.id);
    setConfirmBuy(null);

    try {
      const { data: result, error } = await supabase.rpc('buy_shop_item', {
        p_member_id: currentUser.member.id,
        p_item_id: item.id,
      });

      if (error) throw error;

      switch (result) {
        case 'ok':
          setLocalDkp((prev) => prev - item.price);
          await Promise.all([onDkpChange(), loadItems()]);
          showToast(`Purchased ${item.name} for ${item.price} DKP!`, 'success');
          break;
        case 'out_of_stock':
          await loadItems(); // refresh so UI reflects reality
          showToast('Sorry — that item just sold out!', 'error');
          break;
        case 'insufficient_dkp':
          showToast(`Not enough DKP (need ${item.price}, have ${localDkp})`, 'error');
          break;
        case 'shop_closed':
          showToast('DKP Shop is currently closed', 'error');
          setShopEnabled(false);
          break;
        default:
          showToast('Purchase failed — please try again', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Purchase failed — please try again', 'error');
    } finally {
      setBuyingId(null);
    }
  };

  // ─── ADD ITEM ───
  const addItem = async () => {
    if (!itemName || !itemPrice || !itemStock) {
      showToast('Fill in all fields', 'error');
      return;
    }
    setAddingItem(true);
    try {
      let imageUrl = '';
      if (itemImage) imageUrl = await uploadShopImage(itemImage);

      const { error } = await supabase.from('shop_items').insert({
        name: itemName,
        image_url: imageUrl,
        price: parseInt(itemPrice),
        total_stock: parseInt(itemStock),
        current_stock: parseInt(itemStock),
        created_by: currentUser?.member.username || 'Unknown',
      });

      if (error) throw error;

      setItemName('');
      setItemPrice('');
      setItemStock('');
      setItemImage(null);
      await loadItems();
      showToast(`"${itemName}" added to shop`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to add item', 'error');
    } finally {
      setAddingItem(false);
    }
  };

  // ─── EDIT ITEM ───
  const saveEdit = async (updates: {
    name: string; price: number; current_stock: number; total_stock: number; image_url: string;
  }) => {
    if (!editItem) return;
    try {
      const { error } = await supabase
        .from('shop_items')
        .update(updates)
        .eq('id', editItem.id);
      if (error) throw error;
      await loadItems();
      setEditItem(null);
      showToast('Item updated', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update item', 'error');
    }
  };

  // ─── DELETE ITEM ───
  const executeDelete = async () => {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('shop_items').delete().eq('id', confirmDelete.id);
      if (error) throw error;
      await loadItems();
      setConfirmDelete(null);
      showToast('Item deleted', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete item', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── TOGGLE SHOP ───
  const toggleShop = async () => {
    try {
      const newState = !shopEnabled;
      const { error } = await supabase
        .from('shop_settings')
        .update({ shop_enabled: newState })
        .gt('id', 0);
      if (error) throw error;
      setShopEnabled(newState);
      showToast(newState ? 'Shop is now open' : 'Shop is now closed', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update shop status', 'error');
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesStock = !showInStockOnly || item.current_stock > 0;
    return matchesSearch && matchesStock;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Buy Confirm Modal */}
      {confirmBuy && (
        <ConfirmModal
          title={`Buy ${confirmBuy.name}?`}
          message={`This will cost ${confirmBuy.price} DKP. You currently have ${localDkp} DKP.`}
          confirmLabel="Confirm Purchase"
          confirmClass="bg-cyan-600/20 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-600/30"
          onConfirm={() => executeBuy(confirmBuy)}
          onCancel={() => setConfirmBuy(null)}
        />
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${confirmDelete.name}"?`}
          message="This will permanently remove the item from the shop. This cannot be undone."
          confirmLabel="Delete Item"
          confirmClass="bg-red-600/20 text-red-400 border border-red-500/20 hover:bg-red-600/30"
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteLoading}
        />
      )}

      {/* Edit Modal */}
      {editItem && (
        <EditItemModal
          item={editItem}
          onSave={saveEdit}
          onCancel={() => setEditItem(null)}
        />
      )}

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="text-cyan-400" size={24} />
            DKP Shop
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Your balance:{' '}
            <span className="text-cyan-400 font-bold">{localDkp} DKP</span>
          </p>
        </div>

        {isAdmin && (
          <button onClick={toggleShop}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
              shopEnabled
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}>
            {shopEnabled ? <Lock size={16} /> : <ShieldAlert size={16} />}
            {shopEnabled ? 'Close Shop' : 'Open Shop'}
          </button>
        )}
      </div>

      {/* Closed Banner */}
      {!shopEnabled && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-center font-bold flex items-center justify-center gap-2">
          <Lock size={16} />
          DKP Shop is currently closed
        </div>
      )}

      {/* ─── Admin: Add Item ─── */}
      {isAdmin && (
        <div className="card p-4 space-y-3">
          <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Add Item</h2>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            <input value={itemName} onChange={(e) => setItemName(e.target.value)}
              placeholder="Item name"
              className="bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-cyan-500/50 focus:outline-none" />
            <input value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
              type="number" placeholder="Price (DKP)"
              className="bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-cyan-500/50 focus:outline-none" />
            <input value={itemStock} onChange={(e) => setItemStock(e.target.value)}
              type="number" placeholder="Stock quantity"
              className="bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-cyan-500/50 focus:outline-none" />
            <input type="file" accept="image/*"
              onChange={(e) => setItemImage(e.target.files?.[0] || null)}
              className="bg-black border border-[#333] rounded-xl p-3 text-sm text-gray-400" />
          </div>

          <button onClick={addItem} disabled={addingItem}
            className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {addingItem ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add Item
          </button>
        </div>
      )}

      {/* ─── Search & Filter ─── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text" placeholder="Search items..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-black border border-[#333] rounded-xl text-sm focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 bg-black border border-[#333] rounded-xl px-4 cursor-pointer">
          <Filter size={14} className="text-gray-500" />
          <input type="checkbox" checked={showInStockOnly}
            onChange={(e) => setShowInStockOnly(e.target.checked)}
            className="accent-cyan-400" />
          In stock only
        </label>
      </div>

      {/* ─── Items Grid ─── */}
      {filteredItems.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="mx-auto text-gray-600 mb-3" size={48} />
          <p className="text-gray-500">
            {search ? 'No items match your search' : 'No items in the shop yet'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredItems.map((item) => {
            const outOfStock = item.current_stock <= 0;
            const cantAfford = localDkp < item.price;
            const isBuying = buyingId === item.id;
            const stockPct = Math.round((item.current_stock / Math.max(item.total_stock, 1)) * 100);

            return (
              <div key={item.id}
                className={`card overflow-hidden transition-all ${outOfStock ? 'opacity-60' : ''}`}>

                {/* Image */}
                <div className="h-48 bg-[#111] flex items-center justify-center overflow-hidden relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package size={64} className="text-gray-600" />
                  )}
                  {outOfStock && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-red-400 font-bold text-sm border border-red-500/40 bg-red-500/10 px-3 py-1 rounded-full">
                        OUT OF STOCK
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <div className="font-bold text-base">{item.name}</div>
                    <div className="text-cyan-400 font-bold text-xl mt-0.5">{item.price} DKP</div>
                  </div>

                  {/* Stock bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{item.current_stock} / {item.total_stock} in stock</span>
                      <span className={stockPct <= 20 ? 'text-red-400' : stockPct <= 50 ? 'text-yellow-400' : 'text-green-400'}>
                        {stockPct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          stockPct <= 20 ? 'bg-red-500' : stockPct <= 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => !outOfStock && !cantAfford && setConfirmBuy(item)}
                      disabled={!shopEnabled || outOfStock || cantAfford || isBuying}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isBuying
                        ? <><Loader2 size={14} className="animate-spin" /> Buying...</>
                        : outOfStock
                        ? 'Out of Stock'
                        : cantAfford
                        ? `Need ${item.price - localDkp} more DKP`
                        : 'Buy'}
                    </button>

                    {isAdmin && (
                      <>
                        <button onClick={() => setEditItem(item)}
                          className="px-3 rounded-xl bg-[#222] hover:bg-[#333] text-gray-400 hover:text-white transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setConfirmDelete(item)}
                          className="px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Affordability hint */}
                  {!outOfStock && cantAfford && (
                    <p className="text-xs text-red-400/70 text-center">
                      You need {item.price - localDkp} more DKP to buy this
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
