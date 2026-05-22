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
  X,
  Trash2,
  Edit3,
  Search,
  Filter,
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

  // INSTANT DKP UPDATE
  const [localDkp, setLocalDkp] =
    useState(
      currentUser?.member.dkp || 0
    );

  useEffect(() => {
    setLocalDkp(
      currentUser?.member.dkp || 0
    );
  }, [currentUser]);

  // SEARCH
  const [search, setSearch] =
    useState('');

  const [sortBy, setSortBy] =
    useState<
      | 'newest'
      | 'price-low'
      | 'price-high'
      | 'stock'
    >('newest');

  // MODAL
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

  // TOAST
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
  const filteredItems =
    items
      .filter(
        (i) =>
          i.current_stock > 0 &&
          (i.name
            .toLowerCase()
            .includes(
              search.toLowerCase()
            ) ||
            (i.description || '')
              .toLowerCase()
              .includes(
                search.toLowerCase()
              ))
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

  // BUY ITEM
  const [shopEnabled, setShopEnabled] =
  useState(true);
  const buyItem = async (
    item: ShopItem
  ) => {
    if (!currentUser) {
      showToast(
        'Please login first',
        'error'
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Buy "${item.name}" for ${item.price} DKP?`
      );

    if (!confirmed) return;

    try {
      // GET LATEST MEMBER
      const {
        data: freshMember,
        error: memberError,
      } = await supabase
        .from('members')
        .select('*')
        .eq(
          'id',
          currentUser.member.id
        )
        .single();

      if (memberError) {
        throw memberError;
      }

      // CHECK DKP
      if (
        freshMember.dkp <
        item.price
      ) {
        showToast(
          'Not enough DKP',
          'error'
        );

        return;
      }

      // CHECK STOCK
      if (
        item.current_stock <= 0
      ) {
        showToast(
          'Item out of stock',
          'error'
        );

        return;
      }

      // NEW DKP
      const newDkp =
        freshMember.dkp -
        item.price;

      // INSTANT UI UPDATE
      setLocalDkp(newDkp);

      // UPDATE DKP
      const {
        error: dkpError,
      } = await supabase
        .from('members')
        .update({
          dkp: newDkp,
        })
        .eq(
          'id',
          currentUser.member.id
        );

      if (dkpError) {
        throw dkpError;
      }

      // UPDATE STOCK
      const {
        error: stockError,
      } = await supabase
        .from('shop_items')
        .update({
          current_stock:
            item.current_stock - 1,
        })
        .eq('id', item.id);

      if (stockError) {
        throw stockError;
      }

      // TRANSACTION
      const {
        error: transactionError,
      } = await supabase
        .from('shop_transactions')
        .insert({
          buyer_id:
            currentUser.member.id,
          item_id: item.id,
          quantity: 1,
          total_price: item.price,
          distribution_status:
            'pending',
        });

      if (transactionError) {
        throw transactionError;
      }

      // REFRESH
      await Promise.all([
        onDkpChange(),
        loadItems(),
      ]);

      showToast(
        `Purchased ${item.name}`,
        'success'
      );
    } catch (err) {
      console.error(err);

      showToast(
        'Purchase failed',
        'error'
      );
    }
  };

  // OPEN MODAL
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
        isNaN(stock)
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
          await updateShopItem(
            editingItem.id,
            {
              name,
              description:
                itemForm.description,
              image_url:
                imageUrl,
              price,
              current_stock:
                stock,
              total_stock:
                stock,
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
                itemForm.description,
              image_url:
                imageUrl,
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
            throw error;
          }

          showToast(
            'Item added',
            'success'
          );
        }

        setShowItemModal(false);

        await loadItems();
      } catch (err) {
        console.error(err);

        showToast(
          'Save failed',
          'error'
        );
      }
    };

  // DELETE ITEM
  const handleDeleteItem =
    async (id: number) => {
      const confirmed =
        window.confirm(
          'Delete this item?'
        );

      if (!confirmed) return;

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
                {localDkp} DKP
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
      <div className="flex gap-3">
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

      {/* ITEMS */}
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
                <h3 className="font-bold text-lg">
                  {item.name}
                </h3>

                <p className="text-gray-500 text-sm mt-1">
                  {
                    item.description
                  }
                </p>

                <div className="flex justify-between mt-4">
                  <span className="text-cyan-400 font-bold text-xl">
                    {item.price} DKP
                  </span>

                  <span className="text-green-400 text-sm">
                    {
                      item.current_stock
                    }{' '}
                    in stock
                  </span>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() =>
                      buyItem(item)
                    }
                    className="flex-1 btn-primary py-2"
                  >
                    Buy
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        onClick={() =>
                          openItemModal(
                            item
                          )
                        }
                        className="bg-[#222] hover:bg-[#333] p-2 rounded-xl"
                      >
                        <Edit3
                          size={16}
                        />
                      </button>

                      <button
                        onClick={() =>
                          handleDeleteItem(
                            item.id
                          )
                        }
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-2 rounded-xl"
                      >
                        <Trash2
                          size={16}
                        />
                      </button>
                    </>
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

      {/* MODAL */}
      {showItemModal &&
        isAdmin && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#111] border border-[#222] rounded-3xl p-6 w-full max-w-lg">
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
                        prev
                      ) => ({
                        ...prev,
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
                        prev
                      ) => ({
                        ...prev,
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
                    type="number"
                    value={
                      itemForm.price
                    }
                    onChange={(
                      e
                    ) =>
                      setItemForm(
                        (
                          prev
                        ) => ({
                          ...prev,
                          price:
                            e
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder="Price"
                    className="w-full p-3 rounded-xl bg-black border border-[#333]"
                  />

                  <input
                    type="number"
                    value={
                      itemForm.stock
                    }
                    onChange={(
                      e
                    ) =>
                      setItemForm(
                        (
                          prev
                        ) => ({
                          ...prev,
                          stock:
                            e
                              .target
                              .value,
                        })
                      )
                    }
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
                        prev
                      ) => ({
                        ...prev,
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
                <button
                  onClick={
                    handleSaveItem
                  }
                  className="flex-1 btn-primary py-3"
                >
                  {editingItem
                    ? 'Update Item'
                    : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
