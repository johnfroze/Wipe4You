import {
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  getShopItems,
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

  const [shopEnabled, setShopEnabled] =
    useState(true);

  const [localDkp, setLocalDkp] =
    useState(
      currentUser?.member.dkp || 0
    );

  // ADD ITEM
  const [itemName, setItemName] =
    useState('');

  const [itemPrice, setItemPrice] =
    useState('');

  const [itemStock, setItemStock] =
    useState('');

  const [itemImage, setItemImage] =
    useState<File | null>(null);

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
    }, 3000);
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
            .limit(1)
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

  // LOAD
  useEffect(() => {
    Promise.all([
      loadItems(),
      loadShopSettings(),
    ]).finally(() =>
      setLoading(false)
    );

    // ITEMS REALTIME
    const channel = supabase
      .channel(
        'shop-items-realtime'
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shop_items',
        },
        async () => {
          loadItems();
        }
      )
      .subscribe();

    // SETTINGS REALTIME
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
      supabase.removeChannel(
        channel
      );

      supabase.removeChannel(
        settingsChannel
      );
    };
  }, [loadItems]);

  // LIVE DKP
  useEffect(() => {
    setLocalDkp(
      currentUser?.member.dkp || 0
    );
  }, [currentUser]);

  // BUY ITEM
  const buyItem = async (
    item: ShopItem
  ) => {
    if (!currentUser) return;

    try {
      // CHECK SHOP STATUS
      const {
        data: settings,
        error: settingsError,
      } = await supabase
        .from('shop_settings')
        .select(
          'shop_enabled'
        )
        .limit(1)
        .single();

      if (settingsError) {
        throw settingsError;
      }

      if (
        !settings?.shop_enabled
      ) {
        showToast(
          'DKP Shop is currently closed',
          'error'
        );

        return;
      }

      const confirmed =
        window.confirm(
          `Buy ${item.name} for ${item.price} DKP?`
        );

      if (!confirmed) return;

      // REFRESH MEMBER
      const {
        data: member,
        error: memberError,
      } = await supabase
        .from('members')
        .select('*')
        .eq(
          'id',
          currentUser.member.id
        )
        .single();

      if (memberError)
        throw memberError;

      // DKP CHECK
      if (
        member.dkp <
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

      const newDkp =
        member.dkp -
        item.price;

      // UPDATE UI
      setLocalDkp(newDkp);

      // UPDATE DKP
      await supabase
        .from('members')
        .update({
          dkp: newDkp,
        })
        .eq(
          'id',
          currentUser.member.id
        );

      // UPDATE STOCK
      await supabase
        .from('shop_items')
        .update({
          current_stock:
            item.current_stock - 1,
        })
        .eq('id', item.id);

      // SAVE TRANSACTION
      const {
        error: transactionError,
      } = await supabase
        .from(
          'shop_transactions'
        )
        .insert({
          buyer_id:
            currentUser.member.id,

          buyer_name:
            currentUser.member
              .username,

          item_id: item.id,

          item_name: item.name,

          quantity: 1,

          total_price:
            item.price,

          distribution_status:
            'pending',

          created_at:
            new Date().toISOString(),
        });

      if (transactionError) {
        throw transactionError;
      }

      await Promise.all([
        onDkpChange(),
        loadItems(),
      ]);

      showToast(
        'Purchase successful',
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

  // ADD ITEM
  const addItem = async () => {
    if (
      !itemName ||
      !itemPrice ||
      !itemStock
    ) {
      showToast(
        'Fill all fields',
        'error'
      );

      return;
    }

    try {
      let imageUrl = '';

      if (itemImage) {
        imageUrl =
          await uploadShopImage(
            itemImage
          );
      }

      const {
        error,
      } = await supabase
        .from('shop_items')
        .insert({
          name: itemName,
          image_url: imageUrl,
          price:
            parseInt(
              itemPrice
            ),
          total_stock:
            parseInt(
              itemStock
            ),
          current_stock:
            parseInt(
              itemStock
            ),
          created_by:
            currentUser
              ?.member
              .username ||
            'Unknown',
        });

      if (error)
        throw error;

      setItemName('');
      setItemPrice('');
      setItemStock('');
      setItemImage(null);

      await loadItems();

      showToast(
        'Item added',
        'success'
      );
    } catch (err) {
      console.error(err);

      showToast(
        'Failed to add item',
        'error'
      );
    }
  };

  // DELETE ITEM
  const deleteItem = async (
    item: ShopItem
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${item.name}"?`
      );

    if (!confirmed) return;

    try {
      const { error } =
        await supabase
          .from('shop_items')
          .delete()
          .eq('id', item.id);

      if (error) {
        throw error;
      }

      await loadItems();

      showToast(
        'Item deleted',
        'success'
      );
    } catch (err) {
      console.error(err);

      showToast(
        'Failed deleting item',
        'error'
      );
    }
  };

  // LOADING
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* TOAST */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg ${
            toast.type ===
            'success'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag
              className="text-cyan-400"
              size={24}
            />
            DKP Shop
          </h1>

          <p className="text-gray-500 text-sm mt-1">
            Your balance:{' '}
            <span className="text-cyan-400 font-bold">
              {localDkp} DKP
            </span>
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={async () => {
              try {
                const newState =
                  !shopEnabled;

                const {
                  error,
                } = await supabase
                  .from(
                    'shop_settings'
                  )
                  .update({
                    shop_enabled:
                      newState,
                  })
                  .gt('id', 0);

                if (error) {
                  throw error;
                }

                setShopEnabled(
                  newState
                );

                showToast(
                  newState
                    ? 'Shop opened'
                    : 'Shop closed',
                  'success'
                );
              } catch (err) {
                console.error(err);

                showToast(
                  'Failed updating shop',
                  'error'
                );
              }
            }}
            className={`px-4 py-2 rounded-xl font-bold ${
              shopEnabled
                ? 'bg-red-500/20 text-red-400'
                : 'bg-green-500/20 text-green-400'
            }`}
          >
            {shopEnabled
              ? 'Close Shop'
              : 'Open Shop'}
          </button>
        )}
      </div>

      {/* CLOSED */}
      {!shopEnabled && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-center font-bold">
          DKP Shop is currently closed
        </div>
      )}

      {/* ADMIN ADD */}
      {isAdmin && (
        <div className="card p-4 space-y-3">
          <h2 className="font-bold">
            Add Item
          </h2>

          <div className="grid md:grid-cols-4 gap-3">
            <input
              value={itemName}
              onChange={(e) =>
                setItemName(
                  e.target.value
                )
              }
              placeholder="Item name"
              className="bg-black border border-[#333] rounded-xl p-3"
            />

            <input
              value={itemPrice}
              onChange={(e) =>
                setItemPrice(
                  e.target.value
                )
              }
              type="number"
              placeholder="Price"
              className="bg-black border border-[#333] rounded-xl p-3"
            />

            <input
              value={itemStock}
              onChange={(e) =>
                setItemStock(
                  e.target.value
                )
              }
              type="number"
              placeholder="Stock"
              className="bg-black border border-[#333] rounded-xl p-3"
            />

            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setItemImage(
                  e.target.files?.[0] ||
                    null
                )
              }
              className="bg-black border border-[#333] rounded-xl p-3"
            />
          </div>

          <button
            onClick={addItem}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>
      )}

      {/* ITEMS */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {items.map((item) => (
          <div
            key={item.id}
            className="card overflow-hidden"
          >
            <div className="h-48 bg-[#111] flex items-center justify-center overflow-hidden">
              {item.image_url ? (
                <img
                  src={
                    item.image_url
                  }
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package
                  size={64}
                  className="text-gray-600"
                />
              )}
            </div>

            <div className="p-4">
              <div className="font-bold text-lg">
                {item.name}
              </div>

              <div className="text-cyan-400 font-bold text-xl mt-1">
                {item.price} DKP
              </div>

              <div className="text-sm text-green-400 mt-1">
                {
                  item.current_stock
                }{' '}
                in stock
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() =>
                    buyItem(item)
                  }
                  disabled={
                    !shopEnabled
                  }
                  className="btn-primary flex-1"
                >
                  Buy
                </button>

                {isAdmin && (
                  <>
                    {/* EDIT */}
                    <button
                      onClick={async () => {
                        try {
                          const newName =
                            prompt(
                              'New item name',
                              item.name
                            );

                          if (
                            !newName
                          )
                            return;

                          const newPrice =
                            prompt(
                              'New price',
                              String(
                                item.price
                              )
                            );

                          if (
                            !newPrice
                          )
                            return;

                          const newStock =
                            prompt(
                              'New stock',
                              String(
                                item.current_stock
                              )
                            );

                          if (
                            !newStock
                          )
                            return;

                          const newImage =
                            prompt(
                              'New image URL',
                              item.image_url ||
                                ''
                            );

                          const {
                            error,
                          } = await supabase
                            .from(
                              'shop_items'
                            )
                            .update({
                              name:
                                newName,
                              price:
                                parseInt(
                                  newPrice
                                ),
                              current_stock:
                                parseInt(
                                  newStock
                                ),
                              total_stock:
                                parseInt(
                                  newStock
                                ),
                              image_url:
                                newImage ||
                                '',
                            })
                            .eq(
                              'id',
                              item.id
                            );

                          if (
                            error
                          )
                            throw error;

                          await loadItems();

                          showToast(
                            'Item updated',
                            'success'
                          );
                        } catch (err) {
                          console.error(
                            err
                          );

                          showToast(
                            'Failed updating item',
                            'error'
                          );
                        }
                      }}
                      className="px-4 rounded-xl bg-[#222] hover:bg-[#333]"
                    >
                      ✏️
                    </button>

                    {/* DELETE */}
                    <button
                      onClick={() =>
                        deleteItem(
                          item
                        )
                      }
                      className="px-4 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-400"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
