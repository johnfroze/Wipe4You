import {
  useState,
  useEffect,
  useCallback,
} from 'react';

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

  const [items, setItems] =
    useState<ShopItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  // SHOP STATUS
  const [shopEnabled, setShopEnabled] =
    useState(true);

  // LIVE DKP
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

  // LOAD SHOP SETTINGS
  const loadShopSettings =
    async () => {
      try {
        const { data } =
          await supabase
            .from('shop_settings')
            .select(
              'shop_enabled'
            )
            .single();

        if (data) {
          setShopEnabled(
            data.shop_enabled
          );
        }
      } catch (err) {
        console.error(err);
      }
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
    Promise.all([
      loadItems(),
      loadShopSettings(),
    ]).finally(() =>
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

    const settingsChannel =
      supabase
        .channel(
          'shop-settings-realtime'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'shop_settings',
          },
          async () => {
            loadShopSettings();
          }
        )
        .subscribe();

    return () => {
      channel.unsubscribe();

      supabase.removeChannel(
        channel
      );

      supabase.removeChannel(
        settingsChannel
      );
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

    // SHOP CLOSED
    if (!shopEnabled) {
      showToast(
        'DKP Shop is currently closed',
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
      // GET FRESH MEMBER
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
          'Out of stock',
          'error'
        );

        return;
      }

      // NEW DKP
      const newDkp =
        freshMember.dkp -
        item.price;

      // INSTANT UI
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
        error:
          transactionError,
      } = await supabase
        .from(
          'shop_transactions'
        )
        .insert({
          buyer_id:
            currentUser.member.id,
          item_id: item.id,
          quantity: 1,
          total_price:
            item.price,
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
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  const {
                    error,
                  } = await supabase
                    .from(
                      'shop_settings'
                    )
                    .update({
                      shop_enabled:
                        !shopEnabled,
                    })
                    .eq('id', 1);

                  if (error)
                    throw error;

                  setShopEnabled(
                    !shopEnabled
                  );

                  showToast(
                    !shopEnabled
                      ? 'Shop opened'
                      : 'Shop closed',
                    'success'
                  );
                } catch (err) {
                  console.error(err);

                  showToast(
                    'Failed to update shop',
                    'error'
                  );
                }
              }}
              className={`px-4 py-2 rounded-xl font-medium ${
                shopEnabled
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-green-500/20 text-green-400'
              }`}
            >
              {shopEnabled
                ? 'Close Shop'
                : 'Open Shop'}
            </button>

            <button
              onClick={() =>
                openItemModal()
              }
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Add Item
            </button>
          </div>
        )}
      </div>

      {/* SHOP CLOSED */}
      {!shopEnabled && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-center font-medium">
          DKP Shop is currently closed
        </div>
      )}
    </div>
  );
}
