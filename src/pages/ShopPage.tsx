import { useState, useEffect, useCallback } from 'react';
import {
  getShopItems,
  updateShopItem,
  deleteShopItem,
  uploadShopImage,
  supabase,
} from '@/lib/supabase';
import type { CurrentUser, ShopItem } from '@/types';
import {
  ShoppingBag,
  Plus,
  Package,
  AlertTriangle,
  Check,
  X,
  Minus,
  Trash2,
  Edit3,
  Search,
  Filter,
  Bell,
} from 'lucide-react';

interface Props {
  currentUser: CurrentUser | null;
  onDkpChange: () => void;
}

export function ShopPage({ currentUser, onDkpChange }: Props) {
  const isAdmin = currentUser?.member.role === 'leader' || currentUser?.member.role === 'elder';
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Shop browsing
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high' | 'stock'>('newest');

  // Purchase modal
  const [buyItem, setBuyItem] = useState<ShopItem | null>(null);
  const [buyQty, setBuyQty] = useState(1);
  const [buyConfirm, setBuyConfirm] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [buySuccess, setBuySuccess] = useState('');

  // Add/Edit item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    image: null as File | null,
  });

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadItems = useCallback(async () => {
    try {
      const data = await getShopItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load shop items:', err);
    }
  }, []);

  useEffect(() => {
    loadItems().finally(() => setLoading(false));

    const channel = supabase
      .channel('shop-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_items' }, () => {
        loadItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadItems]);

  const availableItems = items.filter((i) => i.is_active && i.current_stock > 0);

  const filteredItems = availableItems
    .filter(
      (i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.description || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'stock':
          return b.current_stock - a.current_stock;
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const openBuyModal = (item: ShopItem) => {
    if (!currentUser) {
      showToast('Please login to purchase items', 'error');
      return;
    }
    setBuyItem(item);
    setBuyQty(1);
    setBuyConfirm(false);
    setBuyError('');
    setBuySuccess('');
  };

  const handleBuy = async () => {
    if (!buyItem || !currentUser) return;

    const totalCost = buyItem.price * buyQty;

    // Validation
    if (currentUser.member.dkp < totalCost) {
      setBuyError(`You don't have enough DKP. You need ${totalCost - currentUser.member.dkp} more DKP.`);
      return;
    }

    if (buyQty > buyItem.current_stock) {
      setBuyError(`Only ${buyItem.current_stock} remaining in stock.`);
      return;
    }

    if (buyQty < 1) {
      setBuyError('Select at least 1 item.');
      return;
    }

    try {
      // Deduct DKP
      const { error: dkpError } = await supabase
        .from('members')
        .update({ dkp: currentUser.member.dkp - totalCost })
        .eq('id', currentUser.member.id);

      if (dkpError) throw dkpError;

      // Reduce stock
      const { error: stockError } = await supabase
        .from('shop_items')
        .update({ current_stock: buyItem.current_stock - buyQty })
        .eq('id', buyItem.id);

      if (stockError) throw stockError;

      // Create transaction
      const { error: transError } = await supabase.from('shop_transactions').insert({
        buyer_id: currentUser.member.id,
        item_id: buyItem.id,
        quantity: buyQty,
        total_price: totalCost,
        distribution_status: 'pending',
      });

      if (transError) throw transError;

      setBuySuccess(
        `Purchased ${buyQty}x ${buyItem.name} for ${totalCost} DKP. Your new balance: ${
          currentUser.member.dkp - totalCost
        } DKP.`
      );

      await onDkpChange();
      loadItems();

      setTimeout(() => {
        setBuyItem(null);
        setBuySuccess('');
      }, 3000);
    } catch (err) {
      console.error(err);
      setBuyError('Transaction failed. Please try again.');
    }
  };

  const openItemModal = (item?: ShopItem) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        name: item.name,
        description: item.description || '',
        price: String(item.price),
        stock: String(item.current_stock),
        image: null,
      });
    } else {
      setEditingItem(null);
      setItemForm({ name: '', description: '', price: '', stock: '', image: null });
    }
    setShowItemModal(true);
  };

  const handleSaveItem = async () => {
    const name = itemForm.name.trim();
    const price = parseInt(itemForm.price);
    const stock = parseInt(itemForm.stock);

    if (!name || isNaN(price) || price <= 0 || isNaN(stock) || stock <= 0) {
      showToast('Fill all required fields with valid values', 'error');
      return;
    }

    try {
      let imageUrl = editingItem?.image_url || null;

      if (itemForm.image) {
        imageUrl = await uploadShopImage(itemForm.image);
      }

      if (editingItem) {
        // Restocking adds to existing stock
        const stockDiff = stock - editingItem.current_stock;
        const newTotalStock = editingItem.total_stock + Math.max(0, stockDiff);

        await updateShopItem(editingItem.id, {
          name,
          description: itemForm.description || null,
          image_url: imageUrl,
          price,
          current_stock: stock,
          total_stock: newTotalStock,
          is_active: stock > 0,
        });
        showToast('Item updated successfully', 'success');
      } else {
        await supabase.from('shop_items').insert({
          name,
          description: itemForm.description || null,
          image_url: imageUrl,
          price,
          total_stock: stock,
          current_stock: stock,
          created_by: currentUser?.member.id || null,
          is_active: true,
        });
        showToast('Item added to shop', 'success');
      }

      setShowItemModal(false);
      loadItems();
    } catch (err) {
      console.error(err);
      showToast('Failed to save item', 'error');
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Delete this item?')) return;
    try {
      await deleteShopItem(id);
      showToast('Item deleted', 'success');
      loadItems();
    } catch (err) {
      showToast('Failed to delete item', 'error');
    }
  };

  const requestRestock = async (item: ShopItem) => {
    showToast(`Restock request sent for "${item.name}"`, 'success');
  };

  const stockLabel = (stock: number) => {
    if (stock === 0) return <span className="stock-out">Out of Stock</span>;
    if (stock <= 3) return <span className="stock-low">{stock} left!</span>;
    return <span className="stock-ok">{stock} in stock</span>;
  };

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
            <ShoppingBag className="text-cyan-400" size={24} />
            DKP Shop
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {currentUser && (
              <span>
                Your balance:{' '}
                <span className="text-cyan-400 font-bold">{currentUser.member.dkp} DKP</span>
              </span>
            )}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => openItemModal()} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Item
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-2.5 bg-black border border-[#333] rounded-xl text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="pl-10 pr-8 py-2.5 bg-black border border-[#333] rounded-xl text-sm appearance-none cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="stock">Stock: High to Low</option>
          </select>
        </div>
      </div>

      {/* Shop Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="card overflow-hidden hover:border-[#333] transition-all group"
          >
            {/* Image */}
            <div className="h-48 bg-black flex items-center justify-center relative overflow-hidden">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Package className="text-gray-700" size={48} />
              )}
              {item.current_stock <= 3 && item.current_stock > 0 && (
                <div className="absolute top-3 right-3 bg-yellow-500/90 text-black text-xs font-bold px-2 py-1 rounded-lg">
                  Only {item.current_stock} left
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="font-bold text-lg mb-1">{item.name}</h3>
              {item.description && (
                <p className="text-gray-500 text-sm mb-3 line-clamp-2">{item.description}</p>
              )}

              <div className="flex items-center justify-between mb-4">
                <div className="text-cyan-400 text-2xl font-bold tabular-nums">{item.price} DKP</div>
                <div className="text-sm">{stockLabel(item.current_stock)}</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openBuyModal(item)}
                  disabled={item.current_stock <= 0}
                  className="flex-1 btn-primary py-2.5 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Buy
                </button>
                {isAdmin ? (
                  <button
                    onClick={() => openItemModal(item)}
                    className="bg-[#222] hover:bg-[#333] p-2.5 rounded-xl transition-all"
                    title="Edit"
                  >
                    <Edit3 size={16} />
                  </button>
                ) : item.current_stock === 0 ? (
                  <button
                    onClick={() => requestRestock(item)}
                    className="bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 p-2.5 rounded-xl transition-all"
                    title="Request Restock"
                  >
                    <Bell size={16} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="card p-12 text-center">
          <Package className="mx-auto text-gray-600 mb-3" size={48} />
          <p className="text-gray-500">
            {search ? 'No items match your search' : 'No items in shop yet'}
          </p>
          {isAdmin && !search && <p className="text-gray-600 text-sm mt-1">Add items to get started</p>}
        </div>
      )}

      {/* Buy Modal */}
      {buyItem && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-[#111] rounded-3xl p-6 w-full max-w-md border border-[#222] animate-fade-in">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold">Purchase Item</h2>
              <button
                onClick={() => setBuyItem(null)}
                className="text-gray-400 hover:text-white p-2 hover:bg-[#222] rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            {buySuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="text-green-400" size={32} />
                </div>
                <p className="text-green-400 font-medium mb-2">Purchase Successful!</p>
                <p className="text-gray-400 text-sm">{buySuccess}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-5">
                  {buyItem.image_url ? (
                    <img
                      src={buyItem.image_url}
                      alt={buyItem.name}
                      className="w-20 h-20 object-contain bg-black rounded-xl"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-black rounded-xl flex items-center justify-center">
                      <Package className="text-gray-600" size={32} />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold">{buyItem.name}</h3>
                    <div className="text-cyan-400 font-bold">{buyItem.price} DKP each</div>
                    <div className="text-sm text-gray-500">{stockLabel(buyItem.current_stock)}</div>
                  </div>
                </div>

                {/* Quantity Selector */}
                <div className="mb-5">
                  <label className="text-sm text-gray-400 mb-2 block">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setBuyQty(Math.max(1, buyQty - 1))}
                      className="w-10 h-10 bg-[#222] hover:bg-[#333] rounded-xl flex items-center justify-center transition-all"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      value={buyQty}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 1;
                        setBuyQty(Math.max(1, Math.min(v, buyItem.current_stock)));
                      }}
                      min={1}
                      max={buyItem.current_stock}
                      className="flex-1 text-center bg-black border border-[#333] rounded-xl py-2.5 text-lg font-bold"
                    />
                    <button
                      onClick={() => setBuyQty(Math.min(buyItem.current_stock, buyQty + 1))}
                      className="w-10 h-10 bg-[#222] hover:bg-[#333] rounded-xl flex items-center justify-center transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Cost Summary */}
                <div className="card p-4 mb-5">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Total Cost</span>
                    <span className="text-cyan-400 font-bold text-xl">
                      {buyItem.price * buyQty} DKP
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Your Balance</span>
                    <span className="text-gray-300">{currentUser?.member.dkp} DKP</span>
                  </div>
                  {currentUser && currentUser.member.dkp < buyItem.price * buyQty && (
                    <div className="mt-2 text-red-400 text-sm flex items-center gap-1">
                      <AlertTriangle size={14} />
                      Insufficient DKP
                    </div>
                  )}
                </div>

                {buyError && (
                  <div className="bg-red-500/10 text-red-400 p-3 rounded-xl mb-4 text-sm flex items-center gap-2">
                    <AlertTriangle size={16} />
                    {buyError}
                  </div>
                )}

                {!buyConfirm ? (
                  <button
                    onClick={() => setBuyConfirm(true)}
                    disabled={
                      !currentUser ||
                      currentUser.member.dkp < buyItem.price * buyQty ||
                      buyItem.current_stock <= 0
                    }
                    className="btn-primary w-full py-3 disabled:opacity-30"
                  >
                    Confirm Purchase
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-yellow-400 text-sm text-center mb-2">
                      Are you sure? This will deduct {buyItem.price * buyQty} DKP from your balance.
                    </p>
                    <button onClick={handleBuy} className="btn-primary w-full py-3">
                      Yes, Purchase
                    </button>
                    <button
                      onClick={() => setBuyConfirm(false)}
                      className="w-full py-3 text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {showItemModal && isAdmin && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-[#111] rounded-3xl p-6 w-full max-w-lg border border-[#222] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button
                onClick={() => setShowItemModal(false)}
                className="text-gray-400 hover:text-white p-2 hover:bg-[#222] rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Item Name *</label>
                <input
                  value={itemForm.name}
                  onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Legendary Potion"
                  className="w-full p-3 rounded-xl bg-black border border-[#333] text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Description</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Restores 500 HP..."
                  rows={2}
                  className="w-full p-3 rounded-xl bg-black border border-[#333] text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Price (DKP) *</label>
                  <input
                    value={itemForm.price}
                    onChange={(e) => setItemForm((p) => ({ ...p, price: e.target.value }))}
                    type="number"
                    placeholder="100"
                    min={1}
                    className="w-full p-3 rounded-xl bg-black border border-[#333] text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    {editingItem ? 'Stock (edit to restock)' : 'Stock *'}
                  </label>
                  <input
                    value={itemForm.stock}
                    onChange={(e) => setItemForm((p) => ({ ...p, stock: e.target.value }))}
                    type="number"
                    placeholder="10"
                    min={0}
                    className="w-full p-3 rounded-xl bg-black border border-[#333] text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Item Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setItemForm((p) => ({ ...p, image: e.target.files?.[0] || null }))
                  }
                  className="w-full p-3 rounded-xl bg-black border border-[#333] text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-[#222] file:text-white"
                />
              </div>
              {editingItem && (
                <div className="text-yellow-500/80 text-xs">
                  Tip: Increase the stock value to restock this item without creating a new entry.
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              {editingItem && (
                <button
                  onClick={() => handleDeleteItem(editingItem.id)}
                  className="bg-red-600/20 text-red-400 hover:bg-red-600/30 px-4 py-3 rounded-xl transition-all flex items-center gap-2"
                >
                  <Trash2 size={16} /> Delete
                </button>
              )}
              <button onClick={handleSaveItem} className="flex-1 btn-primary py-3">
                {editingItem ? 'Update Item' : 'Add to Shop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
