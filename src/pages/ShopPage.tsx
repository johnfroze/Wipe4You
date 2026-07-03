import { useState, useEffect, useCallback, useRef } from 'react';
import { getShopItems, uploadShopImage, supabase, expireShopItems } from '@/lib/supabase';

// ─── Lightweight spreadsheet parser (no external deps) ───
// Handles .csv files natively and .xlsx via SheetJS CDN loaded lazily
async function parseSpreadsheet(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (file.name.endsWith('.csv')) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) { reject(new Error('CSV has no data rows')); return; }
        const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
        const rows = lines.slice(1).map((line) => {
          const vals = line.split(',').map((v) => v.replace(/^"|"$/g, '').trim());
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = vals[i] || ''; });
          return row;
        });
        resolve({ headers, rows });
      };
      reader.onerror = () => reject(new Error('Failed to read CSV'));
      reader.readAsText(file);
    } else {
      // Load SheetJS from CDN for xlsx support
      reader.onload = async (e) => {
        try {
          if (!(window as any).XLSX) {
            await new Promise<void>((res, rej) => {
              const s = document.createElement('script');
              s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
              s.onload = () => res();
              s.onerror = () => rej(new Error('Failed to load xlsx library'));
              document.head.appendChild(s);
            });
          }
          const XLSX = (window as any).XLSX;
          const wb = XLSX.read(e.target?.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
          if (jsonRows.length === 0) { reject(new Error('No data found')); return; }
          const headers = Object.keys(jsonRows[0]);
          const rows = jsonRows.map((r) => {
            const out: Record<string, string> = {};
            headers.forEach((h) => {
              const v = r[h];
              // Handle Excel date serial
              if (typeof v === 'number' && h.match(/expir|date|until|end/i)) {
                const XLSXLocal = (window as any).XLSX;
                const d = XLSXLocal.SSF.parse_date_code(v);
                out[h] = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
              } else {
                out[h] = String(v ?? '');
              }
            });
            return out;
          });
          resolve({ headers, rows });
        } catch (err: any) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    }
  });
}
import type { CurrentUser, ShopItem } from '@/types';
import {
  ShoppingBag, Plus, Package, Search, Filter,
  X, CheckCircle2, AlertTriangle, Pencil, Trash2,
  Loader2, Lock, ShieldAlert, Timer, CalendarClock, Ticket, Layers, Boxes,
} from 'lucide-react';

// Returns current local datetime string for datetime-local inputs
// e.g. "2026-06-05T14:30"
function getLocalDateTimeString(offsetHours = 0): string {
  const d = new Date(Date.now() + offsetHours * 3600000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


interface Props {
  currentUser: CurrentUser | null;
  onDkpChange: (newDkp?: number) => void;
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
  confirmClass = 'bg-[rgba(212,175,55,0.12)] text-[#D4AF37] border border-[rgba(212,175,55,0.2)] hover:bg-[rgba(212,175,55,0.18)]',
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
  onSave: (updates: { name: string; price: number; current_stock: number; total_stock: number; image_url: string; description: string; expires_at: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [stock, setStock] = useState(String(item.current_stock));
  const [totalStock, setTotalStock] = useState(String(item.total_stock));
  const [imageUrl, setImageUrl] = useState(item.image_url || '');
  const [description, setDescription] = useState(item.description || '');
  const [expiresAt, setExpiresAt] = useState(
    item.expires_at
      ? new Date(item.expires_at).toISOString().slice(0, 16)
      : getLocalDateTimeString(24 * 7)  // default: 7 days from now
  );
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
      description,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Pencil size={16} className="text-[#D4AF37]" /> Edit Item
        </h3>

        {/* Restock banner — shown when item is in raffle state */}
        {item.transferred_to_raffle && (
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-xs text-purple-300">
            <Ticket size={13} className="text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white mb-0.5">Item is currently in Raffle</div>
              <div className="text-purple-400">
                Set <span className="font-bold text-white">Current Stock</span> to more than 0 and save — the item will automatically return to the shop and be removed from the raffle queue.
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Item Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Price (DKP)</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} type="number"
                className="w-full bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Current Stock</label>
              <input value={stock} onChange={(e) => setStock(e.target.value)} type="number"
                className="w-full bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Total Stock</label>
            <input value={totalStock} onChange={(e) => setTotalStock(e.target.value)} type="number"
              className="w-full bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown on the item card..."
              rows={2}
              className="w-full bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none resize-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Expiry Date (optional)</label>
            <div className="relative">
              <CalendarClock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-black border border-[#333] rounded-xl pl-9 pr-3 py-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
              />
            </div>
            {expiresAt && (
              <button onClick={() => setExpiresAt('')}
                className="mt-1 text-[11px] text-gray-600 hover:text-red-400 transition-colors">
                × Clear expiry
              </button>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Image URL (optional)</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..."
              className="w-full bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-2 rounded-xl text-sm bg-[#222] hover:bg-[#333] text-gray-300">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-xl text-sm bg-[rgba(212,175,55,0.12)] text-[#D4AF37] border border-[rgba(212,175,55,0.2)] hover:bg-[rgba(212,175,55,0.18)] flex items-center gap-2">
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
  const [itemExpiresAt, setItemExpiresAt] = useState(() => getLocalDateTimeString(24 * 7));
  const [itemImage, setItemImage] = useState<File | null>(null);
  const [addingItem, setAddingItem] = useState(false);

  // Modals
  const [confirmBuy, setConfirmBuy] = useState<ShopItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShopItem | null>(null);
  const [editItem, setEditItem] = useState<ShopItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmZeroStock, setConfirmZeroStock] = useState(false);
  const [zeroStockLoading, setZeroStockLoading] = useState(false);
  const [showMassRestock, setShowMassRestock] = useState(false);
  const [massRestockValues, setMassRestockValues] = useState<Record<number, string>>({});
  const [massRestockExpiry, setMassRestockExpiry] = useState<Record<number, string>>({});
  const [massRestockSaving, setMassRestockSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadParsed, setUploadParsed] = useState<{ name: string; qty: number; expiry: string }[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSaving, setUploadSaving] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

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
    // Run expiry check first — transfers any expired items to raffles,
    // then load the shop so transferred items are already marked
    expireShopItems().then((count) => {
      if (count > 0) {
        showToast(`${count} expired item${count > 1 ? 's' : ''} moved to Raffle`, 'success');
      }
    });

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

  // Only set localDkp on mount — optimistic updates handle
  // subsequent deductions so admin DKP changes don't
  // overwrite DKP already spent on purchases
  const hasSetInitialDkp = useRef(false);
  useEffect(() => {
    if (currentUser?.member && !hasSetInitialDkp.current) {
      setLocalDkp(currentUser.member.dkp);
      hasSetInitialDkp.current = true;
    }
  }, [currentUser]);

  // Realtime: keep localDkp in sync with actual DB value
  // This ensures refunds, admin adjustments, and attendance
  // DKP gains are reflected correctly without overwriting
  // optimistic deductions mid-purchase
  useEffect(() => {
    if (!currentUser?.member?.id) return;
    const channel = supabase
      .channel('shop-page-dkp')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'members',
        filter: `id=eq.${currentUser.member.id}`,
      }, (payload: any) => {
        if (payload.new?.dkp !== undefined) {
          setLocalDkp(payload.new.dkp);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
          const result2 = await Promise.all([onDkpChange(), loadItems()]);
          void result2;
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
        expires_at: itemExpiresAt ? new Date(itemExpiresAt).toISOString() : null,
      });

      if (error) throw error;

      setItemName('');
      setItemPrice('');
      setItemStock('');
      setItemExpiresAt(getLocalDateTimeString(24 * 7));
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
    name: string; price: number; current_stock: number; total_stock: number;
    image_url: string; description: string; expires_at: string | null;
  }) => {
    if (!editItem) return;
    try {
      // If admin restocks an item that was transferred to raffle,
      // reset raffle flags so it reappears in the shop
      const restockingFromRaffle =
        editItem.transferred_to_raffle && updates.current_stock > 0;

      const payload: Record<string, unknown> = { ...updates };

      if (restockingFromRaffle) {
        payload.transferred_to_raffle = false;
        payload.raffle_id = null;
        // Clear expiry so it doesn't immediately re-expire
        if (!updates.expires_at) {
          payload.expires_at = null;
        }
      }

      const { error } = await supabase
        .from('shop_items')
        .update(payload)
        .eq('id', editItem.id);
      if (error) throw error;
      await loadItems();
      setEditItem(null);
      showToast(
        restockingFromRaffle
          ? 'Item restocked and returned to shop!'
          : 'Item updated',
        'success'
      );
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

  // ─── ZERO ALL STOCK ───
  // Sets current_stock to 0 on every active (non-transferred) item.
  // Useful for quickly closing out a shop cycle without deleting items.
  const zeroAllStock = async () => {
    setZeroStockLoading(true);
    try {
      const activeIds = items
        .filter((i) => !i.transferred_to_raffle)
        .map((i) => i.id);

      if (activeIds.length === 0) {
        showToast('No active items to zero out', 'error');
        setConfirmZeroStock(false);
        return;
      }

      const { error } = await supabase
        .from('shop_items')
        .update({ current_stock: 0 })
        .in('id', activeIds);
      if (error) throw error;

      await loadItems();
      showToast(`${activeIds.length} item${activeIds.length > 1 ? 's' : ''} set to 0 stock`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to zero out stock', 'error');
    } finally {
      setZeroStockLoading(false);
      setConfirmZeroStock(false);
    }
  };

  // ─── MASS RESTOCK ───
  // Opens with current values pre-filled; admin edits any subset
  // of items, then saves all changed values in one batch.
  // Restocking an item that was sent to raffle (transferred_to_raffle=true)
  // automatically returns it to the shop and clears it from the raffle queue.
  const openMassRestock = () => {
    const initialStock: Record<number, string> = {};
    const initialExpiry: Record<number, string> = {};
    items.forEach((i) => {
      initialStock[i.id] = String(i.current_stock);
      initialExpiry[i.id] = i.expires_at
        ? new Date(i.expires_at).toISOString().slice(0, 16)
        : '';
    });
    setMassRestockValues(initialStock);
    setMassRestockExpiry(initialExpiry);
    setShowMassRestock(true);
  };

  const saveMassRestock = async () => {
    setMassRestockSaving(true);
    try {
      const updates = items
        .map((item) => {
          const rawStock = massRestockValues[item.id];
          const newStock = parseInt(rawStock);
          const rawExpiry = massRestockExpiry[item.id] || '';
          const newExpiry = rawExpiry ? new Date(rawExpiry).toISOString() : null;
          const origExpiry = item.expires_at
            ? new Date(item.expires_at).toISOString().slice(0, 16)
            : '';

          const stockChanged = !isNaN(newStock) && newStock !== item.current_stock;
          const expiryChanged = rawExpiry !== origExpiry;

          if (!stockChanged && !expiryChanged) return null;
          return { item, newStock: isNaN(newStock) ? item.current_stock : newStock, newExpiry, stockChanged, expiryChanged };
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

      if (updates.length === 0) {
        showToast('No changes to save', 'error');
        setShowMassRestock(false);
        return;
      }

      await Promise.all(
        updates.map(({ item, newStock, newExpiry, stockChanged, expiryChanged }) => {
          const payload: Record<string, unknown> = {};
          if (stockChanged) payload.current_stock = newStock;
          if (expiryChanged) payload.expires_at = newExpiry;
          // Restocking a raffle item returns it to shop
          if (item.transferred_to_raffle && stockChanged && newStock > 0) {
            payload.transferred_to_raffle = false;
            payload.raffle_id = null;
          }
          return supabase.from('shop_items').update(payload).eq('id', item.id);
        })
      );

      await loadItems();
      const restoredCount = updates.filter((u) => u.item.transferred_to_raffle && u.stockChanged && u.newStock > 0).length;
      showToast(
        `${updates.length} item${updates.length > 1 ? 's' : ''} updated` +
        (restoredCount > 0 ? ` — ${restoredCount} returned from raffle` : ''),
        'success'
      );
      setShowMassRestock(false);
    } catch (err) {
      console.error(err);
      showToast('Failed to save changes', 'error');
    } finally {
      setMassRestockSaving(false);
    }
  };

  // ─── UPLOAD RESTOCK (Excel / CSV) ───
  const handleUploadFile = async (file: File) => {
    setUploadFile(file);
    setUploadError(null);
    setUploadParsed([]);

    try {
      const { rows } = await parseSpreadsheet(file);
      if (rows.length === 0) { setUploadError('File is empty'); return; }

      const keys = Object.keys(rows[0]);
      const nameKey = keys.find((k) => /item|name/i.test(k)) || keys[0];
      const qtyKey  = keys.find((k) => /qty|quantity|stock|count/i.test(k)) || keys[1];
      const expiryKey = keys.find((k) => /expir|date|until|end/i.test(k));

      const parsed = rows
        .map((row) => ({
          name:   row[nameKey]?.trim() || '',
          qty:    parseInt(row[qtyKey] || '0') || 0,
          expiry: expiryKey && row[expiryKey]
            ? (() => {
                const v = row[expiryKey].trim();
                if (!v) return getLocalDateTimeString(24 * 7);
                // Try parsing date string
                const d = new Date(v);
                if (!isNaN(d.getTime())) return d.toISOString().slice(0, 16);
                return getLocalDateTimeString(24 * 7);
              })()
            : getLocalDateTimeString(24 * 7),
        }))
        .filter((r) => r.name && r.qty > 0);

      if (parsed.length === 0) {
        setUploadError('No valid rows found. Make sure columns contain item names and quantities.');
        return;
      }
      setUploadParsed(parsed);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to parse file. Use .xlsx or .csv format.');
    }
  };

  const saveUploadRestock = async () => {
    if (uploadParsed.length === 0) return;
    setUploadSaving(true);
    try {
      let created = 0;
      let updated = 0;

      for (const row of uploadParsed) {
        // Match to existing item by name (case-insensitive)
        const existing = items.find(
          (i) => i.name.toLowerCase() === row.name.toLowerCase()
        );

        const expiryIso = row.expiry ? new Date(row.expiry).toISOString() : null;

        if (existing) {
          // Update existing item
          const payload: Record<string, unknown> = {
            current_stock: existing.current_stock + row.qty,
            total_stock: existing.total_stock + row.qty,
            expires_at: expiryIso,
          };
          if (existing.transferred_to_raffle) {
            payload.transferred_to_raffle = false;
            payload.raffle_id = null;
          }
          await supabase.from('shop_items').update(payload).eq('id', existing.id);
          updated++;
        } else {
          // Create new item
          await supabase.from('shop_items').insert({
            name: row.name,
            current_stock: row.qty,
            total_stock: row.qty,
            price: 0, // Admin can edit price after import
            expires_at: expiryIso,
            created_by: currentUser?.member.username || 'System',
          });
          created++;
        }
      }

      await loadItems();
      showToast(
        `Import complete — ${updated} updated, ${created} new item${created !== 1 ? 's' : ''} created`,
        'success'
      );
      setUploadParsed([]);
      setUploadFile(null);
      setShowUploadPanel(false);
      setShowMassRestock(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      showToast('Import failed — check console for details', 'error');
    } finally {
      setUploadSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesStock = !showInStockOnly || item.current_stock > 0;
    return matchesSearch && matchesStock;
  });

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="skeleton-line w-32 h-7" />
            <div className="skeleton-line w-48 h-4" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="skeleton-block h-48 rounded-none" />
              <div className="p-4 space-y-3">
                <div className="skeleton-line w-3/4 h-4" />
                <div className="skeleton-line w-1/2 h-6" />
                <div className="skeleton-line w-full h-2 rounded-full" />
                <div className="skeleton-block w-full h-10 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
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
          confirmClass="bg-[rgba(212,175,55,0.12)] text-[#D4AF37] border border-[rgba(212,175,55,0.2)] hover:bg-[rgba(212,175,55,0.18)]"
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

      {confirmZeroStock && (
        <ConfirmModal
          title="Zero All Stock?"
          message={`This sets current stock to 0 on all ${items.filter((i) => !i.transferred_to_raffle).length} active shop items. They'll stay visible but become unbuyable until restocked. Items already in raffle are not affected.`}
          confirmLabel="Zero All Stock"
          confirmClass="bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)] hover:bg-[rgba(212,175,55,0.25)]"
          onConfirm={zeroAllStock}
          onCancel={() => setConfirmZeroStock(false)}
          loading={zeroStockLoading}
        />
      )}

      {/* ─── Mass Restock Modal ─── */}
      {showMassRestock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0a0810] border border-[rgba(212,175,55,0.2)] rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[rgba(212,175,55,0.1)] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center">
                  <Boxes size={17} className="text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="font-black text-base">Mass Restock</h3>
                  <p className="text-xs text-gray-500">Edit stock and expiry for any item, or import from Excel/CSV</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUploadPanel((v) => !v)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    showUploadPanel
                      ? 'bg-[rgba(212,175,55,0.15)] border-[rgba(212,175,55,0.35)] text-[#D4AF37]'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-[#D4AF37] hover:border-[rgba(212,175,55,0.2)]'
                  }`}
                >
                  <Plus size={13} /> Import Excel / CSV
                </button>
                <button onClick={() => { setShowMassRestock(false); setShowUploadPanel(false); setUploadParsed([]); setUploadFile(null); }}
                  className="text-gray-600 hover:text-white transition-colors p-1.5">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Upload panel */}
            {showUploadPanel && (
              <div className="border-b border-[rgba(212,175,55,0.1)] p-4 bg-[rgba(212,175,55,0.02)] shrink-0 space-y-3">
                <div
                  className="border-2 border-dashed border-[rgba(212,175,55,0.2)] rounded-xl p-5 text-center cursor-pointer hover:border-[rgba(212,175,55,0.4)] transition-colors"
                  onClick={() => uploadInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) handleUploadFile(f);
                  }}
                >
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); }}
                  />
                  <Plus size={20} className="mx-auto text-[rgba(212,175,55,0.4)] mb-2" />
                  <p className="text-sm text-gray-400 font-medium">
                    {uploadFile ? uploadFile.name : 'Drop Excel / CSV here or click to browse'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Expects columns: Item Name, Quantity, (optional) Expiry Date
                  </p>
                </div>

                {uploadError && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <AlertTriangle size={13} /> {uploadError}
                  </div>
                )}

                {uploadParsed.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#D4AF37]">
                        {uploadParsed.length} item{uploadParsed.length !== 1 ? 's' : ''} parsed — review before importing
                      </p>
                      <button onClick={saveUploadRestock} disabled={uploadSaving}
                        className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3 disabled:opacity-50">
                        {uploadSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Import Now
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {uploadParsed.map((row, i) => {
                        const existingItem = items.find((it) => it.name.toLowerCase() === row.name.toLowerCase());
                        return (
                          <div key={i} className="grid grid-cols-[1fr_60px_1fr_80px] gap-2 items-center px-3 py-1.5 rounded-lg bg-black/40 border border-[rgba(212,175,55,0.08)] text-xs">
                            <span className="font-medium text-gray-200 truncate">{row.name}</span>
                            <span className="text-[#D4AF37] font-bold text-center">+{row.qty}</span>
                            <span className="text-gray-500 truncate">
                              {row.expiry ? new Date(row.expiry).toLocaleDateString() : 'No expiry'}
                            </span>
                            <span className={`text-center font-bold ${existingItem ? 'text-green-400' : 'text-cyan-400'}`}>
                              {existingItem ? 'Update' : 'New'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-gray-600">
                      "Update" adds quantity to existing items. "New" creates a new item with price 0 (edit after import).
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-y-auto p-5">
              {items.length === 0 ? (
                <div className="py-12 text-center">
                  <Package size={36} className="mx-auto text-gray-700 mb-2" />
                  <p className="text-gray-500 text-sm">No items in the shop yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Column headers */}
                  <div className="hidden sm:grid grid-cols-[1fr_80px_80px_160px_110px] gap-3 px-3 pb-2 text-[10px] text-gray-600 uppercase tracking-wider font-bold">
                    <span>Item</span>
                    <span className="text-center">Current</span>
                    <span className="text-center">Total</span>
                    <span>Expiry Date</span>
                    <span className="text-center">Status</span>
                  </div>

                  {items.map((item) => {
                    const now = Date.now();
                    const expiresAt = item.expires_at ? new Date(item.expires_at).getTime() : null;
                    const isExpired = expiresAt !== null && now > expiresAt;
                    const inRaffle = item.transferred_to_raffle === true;
                    const currentVal = massRestockValues[item.id] ?? String(item.current_stock);
                    const expiryVal = massRestockExpiry[item.id] ?? (item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : '');

                    const origExpiry = item.expires_at
                      ? new Date(item.expires_at).toISOString().slice(0, 16)
                      : '';
                    const stockChanged = !isNaN(parseInt(currentVal)) && parseInt(currentVal) !== item.current_stock;
                    const expiryChanged = expiryVal !== origExpiry;
                    const hasChanged = stockChanged || expiryChanged;
                    const willRestoreFromRaffle = inRaffle && parseInt(currentVal) > 0;

                    return (
                      <div
                        key={item.id}
                        className={`grid grid-cols-2 sm:grid-cols-[1fr_80px_80px_160px_110px] gap-2 items-center px-3 py-2.5 rounded-xl border transition-colors ${
                          hasChanged
                            ? 'bg-[rgba(212,175,55,0.06)] border-[rgba(212,175,55,0.3)]'
                            : 'bg-black/30 border-[rgba(212,175,55,0.08)]'
                        }`}
                      >
                        {/* Item name + image */}
                        <div className="flex items-center gap-2.5 min-w-0 col-span-2 sm:col-span-1">
                          {item.image_url
                            ? <img src={item.image_url} alt={item.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                            : <div className="w-8 h-8 rounded-lg bg-[rgba(212,175,55,0.08)] flex items-center justify-center shrink-0">
                                <Package size={14} className="text-gray-600" />
                              </div>
                          }
                          <div className="min-w-0">
                            <div className="text-sm font-bold truncate">{item.name}</div>
                            <div className="text-[11px] text-gray-600">{item.price} DKP</div>
                          </div>
                        </div>

                        {/* Current stock — editable */}
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[10px] text-gray-600 sm:hidden">Qty:</span>
                          <input
                            type="number"
                            min="0"
                            value={currentVal}
                            onChange={(e) => setMassRestockValues((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className={`w-16 text-center bg-black border rounded-lg py-1.5 text-sm font-bold focus:outline-none ${
                              stockChanged
                                ? 'border-[rgba(212,175,55,0.5)] text-[#D4AF37]'
                                : 'border-[rgba(212,175,55,0.15)] text-gray-300'
                            }`}
                          />
                        </div>

                        {/* Total stock — read only */}
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[10px] text-gray-600 sm:hidden">Total:</span>
                          <span className="text-sm text-gray-500 font-medium tabular-nums">{item.total_stock}</span>
                        </div>

                        {/* Expiry — editable datetime */}
                        <div className="col-span-2 sm:col-span-1">
                          <div className="relative">
                            <CalendarClock size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                            <input
                              type="datetime-local"
                              value={expiryVal}
                              onChange={(e) => setMassRestockExpiry((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              className={`w-full pl-6 pr-2 py-1.5 bg-black border rounded-lg text-xs focus:outline-none ${
                                expiryChanged
                                  ? 'border-[rgba(212,175,55,0.5)] text-[#D4AF37]'
                                  : isExpired
                                  ? 'border-red-500/30 text-red-400'
                                  : 'border-[rgba(212,175,55,0.15)] text-gray-400'
                              }`}
                            />
                          </div>
                          {expiryVal && (
                            <button
                              onClick={() => setMassRestockExpiry((prev) => ({ ...prev, [item.id]: '' }))}
                              className="text-[10px] text-gray-700 hover:text-red-400 transition-colors mt-0.5"
                            >
                              × Clear expiry
                            </button>
                          )}
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-center">
                          {inRaffle ? (
                            willRestoreFromRaffle ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full">
                                <CheckCircle2 size={10} /> Will restore
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-full">
                                <Ticket size={10} /> In raffle
                              </span>
                            )
                          ) : isExpired ? (
                            <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-full">
                              Expired
                            </span>
                          ) : item.current_stock <= 0 ? (
                            <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-full">
                              Out of stock
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-500 bg-white/5 border border-white/5 px-2 py-1 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-5 border-t border-[rgba(212,175,55,0.1)] shrink-0">
              <span className="text-xs text-gray-600">
                {items.filter((item) => {
                  const v = massRestockValues[item.id];
                  const e = massRestockExpiry[item.id];
                  const origE = item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : '';
                  const stockChg = v !== undefined && parseInt(v) !== item.current_stock && !isNaN(parseInt(v));
                  const expiryChg = e !== undefined && e !== origE;
                  return stockChg || expiryChg;
                }).length} item(s) changed
              </span>
              <div className="flex gap-3">
                <button onClick={() => setShowMassRestock(false)} disabled={massRestockSaving}
                  className="px-5 py-2.5 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-gray-300 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={saveMassRestock} disabled={massRestockSaving}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {massRestockSaving ? <Loader2 size={14} className="animate-spin" /> : <Boxes size={14} />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
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
            <ShoppingBag className="text-[#D4AF37]" size={24} />
            DKP Shop
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Your balance:{' '}
            <span className="text-[#D4AF37] font-bold">{localDkp} DKP</span>
          </p>
        </div>

        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={openMassRestock}
              className="px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all bg-[rgba(212,175,55,0.08)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.15)] border border-[rgba(212,175,55,0.2)]">
              <Boxes size={16} />
              Mass Restock
            </button>
            <button onClick={() => setConfirmZeroStock(true)}
              className="px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all bg-[rgba(212,175,55,0.08)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.15)] border border-[rgba(212,175,55,0.2)]">
              <Layers size={16} />
              Zero All Stock
            </button>
            <button onClick={toggleShop}
              className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                shopEnabled
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              }`}>
              {shopEnabled ? <Lock size={16} /> : <ShieldAlert size={16} />}
              {shopEnabled ? 'Close Shop' : 'Open Shop'}
            </button>
          </div>
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
              className="bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
            <input value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
              type="number" placeholder="Price (DKP)"
              className="bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
            <input value={itemStock} onChange={(e) => setItemStock(e.target.value)}
              type="number" placeholder="Stock quantity"
              className="bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none" />
            <div className="relative">
              <CalendarClock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type="datetime-local"
                value={itemExpiresAt}
                onChange={(e) => setItemExpiresAt(e.target.value)}
                placeholder="Expiry (optional)"
                className="w-full bg-black border border-[#333] rounded-xl pl-9 pr-3 py-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none text-gray-400"
              />
            </div>
            <input type="file" accept="image/*"
              onChange={(e) => setItemImage(e.target.files?.[0] || null)}
              className="bg-black border border-[#333] rounded-xl p-3 text-sm text-gray-400 sm:col-span-2 md:col-span-4" />
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
            className="w-full pl-10 pr-4 py-2.5 bg-black border border-[#333] rounded-xl text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 bg-black border border-[#333] rounded-xl px-4 cursor-pointer">
          <Filter size={14} className="text-gray-500" />
          <input type="checkbox" checked={showInStockOnly}
            onChange={(e) => setShowInStockOnly(e.target.checked)}
            className="accent-[#D4AF37]" />
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

            // ── Expiration ──
            const now = Date.now();
            const expiresAt = item.expires_at ? new Date(item.expires_at).getTime() : null;
            const isExpired = expiresAt !== null && now > expiresAt;
            const isTransferred = item.transferred_to_raffle === true;
            const msLeft = expiresAt !== null ? Math.max(0, expiresAt - now) : null;
            const hoursLeft = msLeft !== null ? msLeft / 3600000 : null;
            const expiryLabel = msLeft === null ? null
              : msLeft <= 0 ? 'Expired'
              : hoursLeft! < 1 ? `${Math.ceil(msLeft! / 60000)}m left`
              : hoursLeft! < 24 ? `${Math.floor(hoursLeft!)}h left`
              : `${Math.ceil(hoursLeft! / 24)}d left`;
            const expiryClass = msLeft === null ? ''
              : msLeft <= 0 ? 'text-red-400'
              : hoursLeft! < 2 ? 'timer-urgent'
              : hoursLeft! < 24 ? 'timer-warning'
              : 'text-gray-500';
            const isDisabled = outOfStock || isExpired || isTransferred;

            return (
              <div key={item.id}
                className={`card overflow-hidden transition-all ${isDisabled ? 'opacity-60' : ''}`}>

                {/* Image */}
                <div className="h-48 bg-[#111] flex items-center justify-center overflow-hidden relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package size={64} className="text-gray-600" />
                  )}
                  {/* Transferred to raffle overlay */}
                  {isTransferred && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-1.5">
                      <Ticket size={22} className="text-purple-400" />
                      <span className="text-purple-400 font-black text-sm border border-purple-500/40 bg-purple-500/10 px-3 py-1 rounded-full">
                        IN RAFFLE
                      </span>
                      <span className="text-gray-500 text-xs">Check the Raffle page</span>
                    </div>
                  )}
                  {/* Expired overlay (not transferred yet) */}
                  {!isTransferred && isExpired && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1">
                      <Timer size={20} className="text-red-400" />
                      <span className="text-red-400 font-black text-sm border border-red-500/40 bg-red-500/10 px-3 py-1 rounded-full">
                        EXPIRED
                      </span>
                    </div>
                  )}
                  {/* Out of stock overlay (only if not expired) */}
                  {!isExpired && outOfStock && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-red-400 font-bold text-sm border border-red-500/40 bg-red-500/10 px-3 py-1 rounded-full">
                        OUT OF STOCK
                      </span>
                    </div>
                  )}
                  {/* Expiry timer badge (only when active and has expiry) */}
                  {!isExpired && expiryLabel && (
                    <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-[11px] font-bold border border-white/10 ${expiryClass}`}>
                      <Timer size={10} />
                      {expiryLabel}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <div className="font-bold text-base">{item.name}</div>
                    {item.description && (
                      <p className="item-desc mt-0.5">{item.description}</p>
                    )}
                    <div className="text-[#D4AF37] font-bold text-xl mt-1">{item.price} DKP</div>
                  </div>

                  {/* Stock bar — hidden when item is transferred to raffle */}
                  {isTransferred ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(168,85,247,0.06)] border border-[rgba(168,85,247,0.15)] text-xs text-purple-300">
                      <Ticket size={12} className="text-purple-400 shrink-0" />
                      All stock moved to raffle — none remaining in shop
                    </div>
                  ) : (
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
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => !isDisabled && !cantAfford && setConfirmBuy(item)}
                      disabled={!shopEnabled || isDisabled || cantAfford || isBuying}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isBuying
                        ? <><Loader2 size={14} className="animate-spin" /> Buying...</>
                        : isTransferred
                        ? <><Ticket size={14} /> In Raffle</>
                        : isExpired
                        ? <><Timer size={14} /> Expired</>
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
