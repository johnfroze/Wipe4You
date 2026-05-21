import { createClient } from '@supabase/supabase-js';
import type {
  Member,
  Auction,
  ShopItem,
  ShopTransaction,
} from '@/types';

const SUPABASE_URL =
  'https://huvgvbppxllgrqtpcaxx.supabase.co';

const SUPABASE_KEY =
  'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// =========================
// AUTH
// =========================

export async function getSession() {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) throw error;

  return data.session;
}

export async function signInWithDiscord() {
  const { error } =
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo:
          typeof window !== 'undefined'
            ? window.location.origin
            : undefined,
      },
    });

  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// =========================
// MEMBERS
// =========================

export async function getMembers(): Promise<
  Member[]
> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('dkp', {
      ascending: false,
    });

  if (error) throw error;

  return data || [];
}

export async function getMemberByDiscordId(
  discordId: string
): Promise<Member | null> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('discord_id', discordId)
    .single();

  if (
    error &&
    error.code !== 'PGRST116'
  ) {
    throw error;
  }

  return data;
}

export async function upsertMember(
  member: Partial<Member>
) {
  const { error } = await supabase
    .from('members')
    .upsert(member, {
      onConflict: 'discord_id',
    });

  if (error) throw error;
}

export async function updateMemberDkp(
  id: string,
  dkp: number
) {
  const { error } = await supabase
    .from('members')
    .update({ dkp })
    .eq('id', id);

  if (error) throw error;
}

export async function updateMemberRole(
  id: string,
  role: Member['role']
) {
  const { error } = await supabase
    .from('members')
    .update({ role })
    .eq('id', id);

  if (error) throw error;
}

export async function updateMemberUsername(
  id: string,
  username: string
) {
  const { error } = await supabase
    .from('members')
    .update({ username })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteMember(
  id: string
) {
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// =========================
// AUCTIONS
// =========================

export async function getAuctions(): Promise<
  Auction[]
> {
  const { data, error } = await supabase
    .from('auctions')
    .select('*')
    .order('id', {
      ascending: false,
    });

  if (error) throw error;

  return (
    (data || []).map((a) => ({
      ...a,
      currentBid: a.current_bid,
      highestBidder: a.highest_bidder,
      endTime: a.end_time,
    })) as Auction[]
  );
}

export async function createAuction(
  auction: Partial<Auction>
) {
  const { error } = await supabase
    .from('auctions')
    .insert({
      id: Date.now(),
      item: auction.item || '',
      image: auction.image || '',
      current_bid:
        auction.current_bid || 0,
      increment: auction.increment || 1,
      highest_bidder: 'None',
      end_time: auction.end_time || 0,
      ended: false,
      history: [],
    });

  if (error) {
    console.error(error);
    throw error;
  }
}

export async function updateAuction(
  id: number,
  updates: Partial<Auction>
) {
  const dbUpdates: Record<
    string,
    unknown
  > = {};

  if (
    updates.current_bid !== undefined
  ) {
    dbUpdates.current_bid =
      updates.current_bid;
  }

  if (
    updates.highest_bidder !==
    undefined
  ) {
    dbUpdates.highest_bidder =
      updates.highest_bidder;
  }

  if (
    updates.history !== undefined
  ) {
    dbUpdates.history =
      updates.history;
  }

  if (
    updates.end_time !== undefined
  ) {
    dbUpdates.end_time =
      updates.end_time;
  }

  if (
    updates.ended !== undefined
  ) {
    dbUpdates.ended =
      updates.ended;
  }

  const { error } = await supabase
    .from('auctions')
    .update(dbUpdates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteAuction(
  id: number
) {
  const { error } = await supabase
    .from('auctions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// =========================
// STORAGE
// =========================

export async function uploadAuctionImage(
  file: File
): Promise<string> {
  const fileName = `${Date.now()}-${
    file.name
  }`;

  const { error } =
    await supabase.storage
      .from('auction-images')
      .upload(fileName, file, {
        upsert: true,
      });

  if (error) throw error;

  const { data } = supabase.storage
    .from('auction-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

export async function uploadShopImage(
  file: File
): Promise<string> {
  const fileName = `${Date.now()}-${
    file.name
  }`;

  const { error } =
    await supabase.storage
      .from('shop-images')
      .upload(fileName, file, {
        upsert: true,
      });

  if (error) throw error;

  const { data } = supabase.storage
    .from('shop-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

// =========================
// SHOP ITEMS
// =========================

export async function getShopItems(): Promise<
  ShopItem[]
> {
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .order('id', {
      ascending: false,
    });

  if (error) {
    console.error(
      'GET SHOP ITEMS ERROR:',
      error
    );

    throw error;
  }

  return data || [];
}

export async function createShopItem(
  item: Partial<ShopItem>
) {
  const payload = {
    name: item.name || '',
    description:
      item.description || '',
    image_url:
      item.image_url || '',
    price: Number(item.price) || 0,
    total_stock:
      Number(item.total_stock) || 0,
    current_stock:
      Number(item.total_stock) || 0,
    created_by:
      item.created_by || 'Unknown',
  };

  console.log(
    'INSERTING SHOP ITEM:',
    payload
  );

  const { data, error } = await supabase
    .from('shop_items')
    .insert(payload)
    .select();

  if (error) {
    console.error(
      'SHOP INSERT ERROR:',
      error
    );

    throw error;
  }

  console.log(
    'SHOP INSERT SUCCESS:',
    data
  );

  return data;
}

export async function updateShopItem(
  id: number,
  updates: Partial<ShopItem>
) {
  const { error } = await supabase
    .from('shop_items')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteShopItem(
  id: number
) {
  const { error } = await supabase
    .from('shop_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// =========================
// SHOP TRANSACTIONS
// =========================

export async function getShopTransactions(): Promise<
  ShopTransaction[]
> {
  const { data, error } = await supabase
    .from('shop_transactions')
    .select(
      '*, buyer:members(*), item:shop_items(*)'
    )
    .order('purchase_timestamp', {
      ascending: false,
    });

  if (error) throw error;

  return data || [];
}

export async function getMyTransactions(
  buyerId: string
): Promise<ShopTransaction[]> {
  const { data, error } = await supabase
    .from('shop_transactions')
    .select('*, item:shop_items(*)')
    .eq('buyer_id', buyerId)
    .order('purchase_timestamp', {
      ascending: false,
    });

  if (error) throw error;

  return data || [];
}

export async function createTransaction(
  transaction: Partial<ShopTransaction>
) {
  const { error } = await supabase
    .from('shop_transactions')
    .insert({
      buyer_id:
        transaction.buyer_id,
      item_id:
        transaction.item_id,
      quantity:
        transaction.quantity || 1,
      total_price:
        transaction.total_price || 0,
      distribution_status:
        'pending',
    });

  if (error) throw error;
}

export async function distributeTransaction(
  id: number,
  distributedBy: string
) {
  const { error } = await supabase
    .from('shop_transactions')
    .update({
      distribution_status:
        'distributed',
      distributed_by:
        distributedBy,
      distributed_at:
        new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteTransaction(
  id: number
) {
  const { error } = await supabase
    .from('shop_transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
