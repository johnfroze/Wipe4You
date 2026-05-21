import { useState, useEffect, useCallback } from 'react';

import {
  getShopItems,
  updateShopItem,
  deleteShopItem,
  uploadShopImage,
  supabase,
} from '@/lib/supabase';

import type {
  CurrentUser,
  ShopItem,
} from '@/types';

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

export function ShopPage({
  currentUser,
  onDkpChange,
}: Props) {
  const isAdmin =
    currentUser?.member.role ===
      'leader' ||
    currentUser?.member.role ===
      'elder';

  const [items, setItems] = useState<
    ShopItem[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  // Search
  const [search, setSearch] =
    useState('');

  const [sortBy, setSortBy] =
    useState<
      | 'newest'
      | 'price-low'
      | 'price-high'
      | 'stock'
    >('newest');

  // Buy Modal
  const [buyItem, setBuyItem] =
    useState<ShopItem | null>(null);

  const [buyQty, setBuyQty] =
    useState(1);

  const [buyConfirm, setBuyConfirm] =
    useState(false);

  const [buyError, setBuyError] =
    useState('');

  const [buySuccess, setBuySuccess] =
    useState('');

  // Add/Edit Modal
  const [
    showItemModal,
    setShowItemModal,
  ] = useState(false);

  const [editingItem, setEditingItem] =
    useState<ShopItem | null>(null);

  const [itemForm, setItemForm] =
    useState({
      name: '',
      description: '',
      price: '',
      stock: '',
      image: null as File | null,
    });

  // Toast
  const [toast, setToast] =
    useState<{
      message: string;
      type: 'success' | 'error';
    } | null>(null);

  const showToast = (
    message: string,
    type: 'success' | 'error'
  ) => {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // LOAD ITEMS
  const loadItems = useCallback(
    async () => {
      try {
        const data =
          await getShopItems();

        setItems(data);
      } catch (err) {
        console.error(err);
      }
    },
    []
  );

  // REALTIME
  useEffect(() => {
    loadItems().finally(() =>
      setLoading(false)
    );

    const channel = supabase
      .channel('shop-realtime-page')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shop_items',
        },
        async () => {
          const data =
            await getShopItems();

          setItems(data);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [loadItems]);

  // FILTER ITEMS
  const availableItems =
    items.filter(
      (i) => i.current_stock > 0
    );

  const filteredItems =
    availableItems
      .filter(
        (i) =>
          i.name
            .toLowerCase()
            .includes(
              search.toLowerCase()
            ) ||
          (i.description || '')
            .toLowerCase()
            .includes(
              search.toLowerCase()
            )
      )
      .sort((a, b) => {
        switch (sortBy) {
          case 'price-low':
            return (
              a.price - b.price
            );

          case 'price-high':
            return (
              b.price - a.price
            );

          case 'stock':
            return (
              b.current_stock -
              a.current_stock
            );

          default:
            return b.id - a.id;
        }
      });

  // BUY MODAL
  const openBuyModal = (
    item: ShopItem
  ) => {
    if (!currentUser) {
      showToast(
        'Please login first',
        'error'
      );
      return;
    }

    setBuyItem(item);
    setBuyQty(1);
    setBuyConfirm(false);
    setBuyError('');
    setBuySuccess('');
  };

  // BUY ITEM
  const handleBuy = async () => {
    if (!buyItem || !currentUser)
      return;

    const totalCost =
      buyItem.price * buyQty;

    if (
      currentUser.member.dkp <
      totalCost
    ) {
      setBuyError(
        'Not enough DKP'
      );
      return;
    }

    if (
      buyQty >
      buyItem.current_stock
    ) {
      setBuyError(
        'Not enough stock'
      );
      return;
    }

    try {
      // Remove DKP
      await supabase
        .from('members')
        .update({
          dkp:
            currentUser.member
              .dkp - totalCost,
        })
        .eq(
          'id',
          currentUser.member.id
        );

      // Reduce stock
      await supabase
        .from('shop_items')
        .update({
          current_stock:
            buyItem.current_stock -
            buyQty,
        })
        .eq('id', buyItem.id);

      // Create transaction
      await supabase
        .from('shop_transactions')
        .insert({
          buyer_id:
            currentUser.member.id,
          item_id: buyItem.id,
          quantity: buyQty,
          total_price:
            totalCost,
          distribution_status:
            'pending',
        });

      setBuySuccess(
        `Purchased ${buyQty}x ${buyItem.name}`
      );

      await onDkpChange();

      loadItems();

      setTimeout(() => {
        setBuyItem(null);
      }, 2500);
    } catch (err) {
      console.error(err);

      setBuyError(
        'Purchase failed'
      );
    }
  };

  // OPEN ITEM MODAL
  const openItemModal = (
    item?: ShopItem
  ) => {
    if (item) {
      setEditingItem(item);

      setItemForm({
        name: item.name,
        description:
          item.description || '',
        price: String(item.price),
        stock: String(
          item.current_stock
        ),
        image: null,
      });
    } else {
      setEditingItem(null);

      setItemForm({
        name: '',
        description: '',
        price: '',
        stock: '',
        image: null,
      });
    }

    setShowItemModal(true);
  };

  // SAVE ITEM
  const handleSaveItem =
    async () => {
      const name =
        itemForm.name.trim();

      const price = parseInt(
        itemForm.price
      );

      const stock = parseInt(
        itemForm.stock
      );

      if (
        !name ||
        isNaN(price) ||
        price <= 0 ||
        isNaN(stock) ||
        stock <= 0
      ) {
        showToast(
          'Invalid values',
          'error'
        );

        return;
      }

      try {
        let imageUrl =
          editingItem?.image_url ||
          '';

        if (itemForm.image) {
          imageUrl =
            await uploadShopImage(
              itemForm.image
            );
        }

        // UPDATE
        if (editingItem) {
          const stockDiff =
            stock -
            editingItem.current_stock;

          const newTotalStock =
            editingItem.total_stock +
            Math.max(
              0,
              stockDiff
            );

          await updateShopItem(
            editingItem.id,
            {
              name,
              description:
                itemForm.description ||
                '',
              image_url:
                imageUrl || '',
              price,
              current_stock:
                stock,
              total_stock:
                newTotalStock,
            }
          );

          showToast(
            'Item updated',
            'success'
          );
        }

        // CREATE
        else {
          const {
            error,
          } = await supabase
            .from('shop_items')
            .insert({
              name,
              description:
                itemForm.description ||
                '',
              image_url:
                imageUrl || '',
              price,
              total_stock:
                stock,
              current_stock:
                stock,
              created_by:
                currentUser
                  ?.member
                  .username ||
                'Unknown',
            });

          if (error) {
            console.error(error);
            throw error;
          }

          showToast(
            'Item added to shop',
            'success'
          );
        }

        setShowItemModal(false);

        await loadItems();
      } catch (err) {
        console.error(err);

        showToast(
          'Failed to save item',
          'error'
        );
      }
    };

  // DELETE ITEM
  const handleDeleteItem =
    async (id: number) => {
      if (
        !confirm(
          'Delete this item?'
        )
      )
        return;

      try {
        await deleteShopItem(id);

        showToast(
          'Item deleted',
          'success'
        );

        loadItems();
      } catch (err) {
        console.error(err);

        showToast(
          'Delete failed',
          'error'
        );
      }
    };

  // STOCK LABEL
  const stockLabel = (
    stock: number
  ) => {
    if (stock === 0) {
      return (
        <span className="text-red-400 text-xs">
          Out of Stock
        </span>
      );
    }

    if (stock <= 3) {
      return (
        <span className="text-yellow-400 text-xs">
          {stock} left
        </span>
      );
    }

    return (
      <span className="text-green-400 text-xs">
        {stock} in stock
      </span>
    );
  };

  // LOADING
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* TOAST */}
      {toast && (
        <div
          className={`toast ${
            toast.type ===
            'success'
              ? 'toast-success'
              : 'toast-error'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag
              className="text-cyan-400"
              size={24}
            />
            DKP Shop
          </h1>

          {currentUser && (
            <p className="text-gray-500 text-sm mt-1">
              Your balance:{' '}
              <span className="text-cyan-400 font-bold">
                {
                  currentUser.member
                    .dkp
                }{' '}
                DKP
              </span>
            </p>
          )}
        </div>

        {isAdmin && (
          <button
            onClick={() =>
              openItemModal()
            }
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Add Item
          </button>
        )}
      </div>

      {/* SEARCH */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            size={16}
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-2.5 bg-black border border-[#333] rounded-xl text-sm"
          />
        </div>

        <div className="relative">
          <Filter
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            size={16}
          />

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target
                  .value as typeof sortBy
              )
            }
            className="pl-10 pr-8 py-2.5 bg-black border border-[#333] rounded-xl text-sm"
          >
            <option value="newest">
              Newest
            </option>

            <option value="price-low">
              Price Low
            </option>

            <option value="price-high">
              Price High
            </option>

            <option value="stock">
              Stock
            </option>
          </select>
        </div>
      </div>

      {/* GRID */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredItems.map(
          (item) => (
            <div
              key={item.id}
              className="card overflow-hidden"
            >
              <div className="h-48 bg-black flex items-center justify-center overflow-hidden">
                {item.image_url ? (
                  <img
                    src={
                      item.image_url
                    }
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Package
                    className="text-gray-700"
                    size={48}
                  />
                )}
              </div>

              <div className="p-4">
                <h3 className="font-bold text-lg mb-1">
                  {item.name}
                </h3>

                {item.description && (
                  <p className="text-gray-500 text-sm mb-3">
                    {
                      item.description
                    }
                  </p>
                )}

                <div className="flex justify-between mb-4">
                  <div className="text-cyan-400 text-2xl font-bold">
                    {item.price} DKP
                  </div>

                  <div>
                    {stockLabel(
                      item.current_stock
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      openBuyModal(
                        item
                      )
                    }
                    className="flex-1 btn-primary py-2.5"
                  >
                    Buy
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() =>
                        openItemModal(
                          item
                        )
                      }
                      className="bg-[#222] hover:bg-[#333] p-2.5 rounded-xl"
                    >
                      <Edit3
                        size={16}
                      />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* EMPTY */}
      {filteredItems.length ===
        0 && (
        <div className="card p-12 text-center">
          <Package
            className="mx-auto text-gray-600 mb-3"
            size={48}
          />

          <p className="text-gray-500">
            No items in shop yet
          </p>
        </div>
      )}

      {/* ADD ITEM MODAL */}
      {showItemModal &&
        isAdmin && (
          <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
            <div className="bg-[#111] rounded-3xl p-6 w-full max-w-lg border border-[#222]">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold">
                  {editingItem
                    ? 'Edit Item'
                    : 'Add Item'}
                </h2>

                <button
                  onClick={() =>
                    setShowItemModal(
                      false
                    )
                  }
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <input
                  value={
                    itemForm.name
                  }
                  onChange={(
                    e
                  ) =>
                    setItemForm(
                      (
                        p
                      ) => ({
                        ...p,
                        name: e
                          .target
                          .value,
                      })
                    )
                  }
                  placeholder="Item Name"
                  className="w-full p-3 rounded-xl bg-black border border-[#333]"
                />

                <textarea
                  value={
                    itemForm.description
                  }
                  onChange={(
                    e
                  ) =>
                    setItemForm(
                      (
                        p
                      ) => ({
                        ...p,
                        description:
                          e
                            .target
                            .value,
                      })
                    )
                  }
                  placeholder="Description"
                  className="w-full p-3 rounded-xl bg-black border border-[#333]"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={
                      itemForm.price
                    }
                    onChange={(
                      e
                    ) =>
                      setItemForm(
                        (
                          p
                        ) => ({
                          ...p,
                          price:
                            e
                              .target
                              .value,
                        })
                      )
                    }
                    type="number"
                    placeholder="Price"
                    className="w-full p-3 rounded-xl bg-black border border-[#333]"
                  />

                  <input
                    value={
                      itemForm.stock
                    }
                    onChange={(
                      e
                    ) =>
                      setItemForm(
                        (
                          p
                        ) => ({
                          ...p,
                          stock:
                            e
                              .target
                              .value,
                        })
                      )
                    }
                    type="number"
                    placeholder="Stock"
                    className="w-full p-3 rounded-xl bg-black border border-[#333]"
                  />
                </div>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(
                    e
                  ) =>
                    setItemForm(
                      (
                        p
                      ) => ({
                        ...p,
                        image:
                          e
                            .target
                            .files?.[0] ||
                          null,
                      })
                    )
                  }
                  className="w-full p-3 rounded-xl bg-black border border-[#333]"
                />
              </div>

              <div className="flex gap-2 mt-5">
                {editingItem && (
                  <button
                    onClick={() =>
                      handleDeleteItem(
                        editingItem.id
                      )
                    }
                    className="bg-red-600/20 text-red-400 hover:bg-red-600/30 px-4 py-3 rounded-xl flex items-center gap-2"
                  >
                    <Trash2
                      size={16}
                    />
                    Delete
                  </button>
                )}

                <button
                  onClick={
                    handleSaveItem
                  }
                  className="flex-1 btn-primary py-3"
                >
                  {editingItem
                    ? 'Update Item'
                    : 'Add to Shop'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
