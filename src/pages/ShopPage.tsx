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

  // INSTANT DKP UI
  const [localDkp, setLocalDkp] =
    useState(
      currentUser?.member.dkp || 0
    );

  useEffect(() => {
    setLocalDkp(
      currentUser?.member.dkp || 0
    );
  }, [currentUser]);

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

  // BUY ITEM
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

    // CONFIRM
    const confirmed =
      window.confirm(
        `Buy "${item.name}" for ${item.price} DKP?`
      );

    if (!confirmed) return;

    try {
      // GET FRESH MEMBER DATA
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

      // DKP CHECK
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

      // STOCK CHECK
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

      // CREATE TRANSACTION
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

      // REFRESH UI
      await Promise.all([
        onDkpChange(),
        loadItems(),
      ]);

      // SUCCESS
      showToast(
        `Purchased ${item.name} for ${item.price} DKP`,
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
    </div>
  );
}
