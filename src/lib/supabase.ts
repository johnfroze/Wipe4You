import { createClient } from '@supabase/supabase-js';
import type {
  Member,
  Auction,
  ShopItem,
  ShopTransaction,
  DkpLog,
  Announcement,
  Raffle,
  RafflePrize,
  RaffleEntry,
} from '@/types';

const SUPABASE_URL =
  'https://huvgvbppxllgrqtpcaxx.supabase.co';

const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dmd2YnBweGxsZ3JxdHBjYXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTE4NTEsImV4cCI6MjA5NDgyNzg1MX0.5xBd2gB8sycVab4FOhcnXl6Nrql1ZAmSsfOgQGfMY54';

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
      required_event_name: auction.required_event_name || null,
    });

  if (error) throw error;
}

// Atomic bid placement with attendance gate check
// Returns: 'ok' | 'not_eligible' | 'bid_too_low' | 'auction_ended'
export async function placeBid(
  auctionId: number,
  memberId: string,
  bid: number
): Promise<string> {
  const { data, error } = await supabase.rpc('place_bid', {
    p_auction_id: auctionId,
    p_member_id:  memberId,
    p_bid:        bid,
  });
  if (error) throw error;
  return data as string;
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

  if (error) throw error;

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

  const { data, error } = await supabase
    .from('shop_items')
    .insert(payload)
    .select();

  if (error) throw error;

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

// =========================
// AUCTION — ATOMIC END (race-condition safe)
// =========================
// Call this instead of manually setting ended=true in the client.
// The Postgres function uses FOR UPDATE row locking so only one
// caller can process the winner, even if multiple tabs fire at once.
//
// Run this SQL in Supabase once:
//
// create or replace function end_auction(p_auction_id bigint)
// returns text language plpgsql security definer as $$
// declare
//   v_auction auctions%rowtype;
//   v_winner  members%rowtype;
// begin
//   select * into v_auction from auctions
//     where id = p_auction_id for update;
//
//   if v_auction.ended then
//     return 'already_ended';
//   end if;
//
//   update auctions set ended = true where id = p_auction_id;
//
//   if v_auction.highest_bidder is null
//     or v_auction.highest_bidder = 'None' then
//     return 'no_winner';
//   end if;
//
//   select * into v_winner from members
//     where username = v_auction.highest_bidder for update;
//
//   if not found then
//     return 'winner_not_found';
//   end if;
//
//   update members
//     set dkp = greatest(0, dkp - v_auction.current_bid)
//     where id = v_winner.id;
//
//   return 'ok';
// end;
// $$;

export async function endAuctionAtomic(auctionId: number): Promise<string> {
  const { data, error } = await supabase.rpc('end_auction', {
    p_auction_id: auctionId,
  });
  if (error) throw error;
  return data as string;
}

// =========================
// REALTIME — MEMBERS SUBSCRIPTION
// =========================
// Subscribes to all member row changes and calls the callback.
// Returns an unsubscribe function. Use in App.tsx to keep the
// members list fresh without polling.
export function subscribeMembersRealtime(onUpdate: () => void): () => void {
  const channel = supabase
    .channel('members-global-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'members' },
      () => onUpdate()
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// =========================
// DKP LOG
// =========================

export async function getDkpLogs(memberId?: string): Promise<DkpLog[]> {
  let query = supabase
    .from('dkp_log')
    .select('*')
    .order('created_at', { ascending: false });
  if (memberId) query = query.eq('member_id', memberId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createDkpLog(entry: Omit<DkpLog, 'id' | 'created_at'>) {
  const { error } = await supabase.from('dkp_log').insert(entry);
  if (error) throw error;
}

export async function clearDkpLogs() {
  const { error } = await supabase.from('dkp_log').delete().neq('id', 0);
  if (error) throw error;
}

// =========================
// ANNOUNCEMENTS
// =========================

export async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createAnnouncement(a: Pick<Announcement, 'title' | 'body' | 'author_name' | 'pinned'>) {
  const { error } = await supabase.from('announcements').insert(a);
  if (error) throw error;
}

export async function updateAnnouncement(id: number, updates: Partial<Announcement>) {
  const { error } = await supabase.from('announcements').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: number) {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}

// =========================
// MEMBER PROFILE (aggregated)
// =========================

export async function getMemberProfile(memberId: string) {
  const [dkpLogs, attendanceLogs, shopPurchases, auctions] = await Promise.all([
    getDkpLogs(memberId),
    supabase
      .from('attendance_log')
      .select('*')
      .eq('member_id', memberId)
      .order('recorded_at', { ascending: false })
      .then(({ data }) => data || []),
    supabase
      .from('shop_transactions')
      .select('*, item:shop_items(*)')
      .eq('buyer_id', memberId)
      .order('purchase_timestamp', { ascending: false })
      .then(({ data }) => data || []),
    supabase
      .from('auctions')
      .select('*')
      .eq('ended', true)
      .then(({ data }) => data || []),
  ]);

  const auctionWins = auctions.filter(
    (a: any) => a.highest_bidder && a.highest_bidder !== 'None' && a.highest_bidder !== ''
  );

  return { dkpLogs, attendanceLogs, shopPurchases, auctionWins };
}

// =========================
// RAFFLES v2 — multi-item, multi-winner
// =========================

export async function getRaffles(): Promise<Raffle[]> {
  const { data, error } = await supabase
    .from('raffles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createRaffle(r: {
  title: string;
  description?: string | null;
  ticket_price: number;
  max_tickets?: number | null;
  winner_count: number;
  draw_at?: string | null;
  required_event_name?: string | null;
  created_by: string;
}): Promise<number> {
  const { data, error } = await supabase
    .from('raffles')
    .insert({
      title:               r.title,
      description:         r.description || null,
      ticket_price:        r.ticket_price,
      max_tickets:         r.max_tickets || null,
      winner_count:        r.winner_count,
      status:              'open',
      draw_at:             r.draw_at || null,
      required_event_name: r.required_event_name || null,
      created_by:          r.created_by,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateRaffle(id: number, updates: Partial<Raffle>): Promise<void> {
  const { error } = await supabase.from('raffles').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteRaffle(id: number): Promise<void> {
  const { error } = await supabase.from('raffles').delete().eq('id', id);
  if (error) throw error;
}

// Atomic cancel: refunds all ticket buyers and logs each refund in dkp_log
// Returns number of members refunded
export async function cancelRaffleWithRefund(raffleId: number): Promise<number> {
  const { data, error } = await supabase.rpc('cancel_raffle_with_refund', {
    p_raffle_id: raffleId,
  });
  if (error) throw error;
  return (data as number) || 0;
}

export async function getRafflePrizes(raffleId: number): Promise<RafflePrize[]> {
  const { data, error } = await supabase
    .from('raffle_prizes')
    .select('*')
    .eq('raffle_id', raffleId)
    .order('id');
  if (error) throw error;
  return data || [];
}

export async function addRafflePrize(prize: {
  raffle_id: number;
  item_id: number | null;
  item_name: string;
  item_image: string | null;
}): Promise<void> {
  const { error } = await supabase.from('raffle_prizes').insert(prize);
  if (error) throw error;
}

export async function removeRafflePrize(prizeId: number): Promise<void> {
  const { error } = await supabase.from('raffle_prizes').delete().eq('id', prizeId);
  if (error) throw error;
}

export async function getRaffleEntries(raffleId: number): Promise<RaffleEntry[]> {
  const { data, error } = await supabase
    .from('raffle_entries')
    .select('*')
    .eq('raffle_id', raffleId)
    .order('entered_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function enterRaffle(raffleId: number, memberId: string, tickets: number = 1): Promise<string> {
  const { data, error } = await supabase.rpc('enter_raffle', {
    p_raffle_id: raffleId,
    p_member_id: memberId,
    p_tickets:   tickets,
  });
  if (error) throw error;
  return data as string;
}

export async function drawRaffleWinners(raffleId: number): Promise<
  { prize: string; winner: string }[] | { error: string }
> {
  const { data, error } = await supabase.rpc('draw_raffle_winners', {
    p_raffle_id: raffleId,
  });
  if (error) throw error;
  return data as { prize: string; winner: string }[] | { error: string };
}

export async function getExpiredQueuedItems() {
  const { data, error } = await supabase
    .from('shop_items')
    .select('id, name, image_url, price, current_stock, expires_at, raffle_id')
    .eq('transferred_to_raffle', true)
    .is('raffle_id', null)
    .gt('current_stock', 0)          // only items with unsold stock
    .order('expires_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function assignItemsToRaffle(itemIds: number[], raffleId: number): Promise<void> {
  const { error } = await supabase
    .from('shop_items')
    .update({ raffle_id: raffleId })
    .in('id', itemIds);
  if (error) throw error;
}

// Get all distinct event names from attendance_log for the admin dropdown
export async function getDistinctEventNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from('attendance_log')
    .select('event_name')
    .order('event_name');
  if (error) throw error;
  const unique = [...new Set((data || []).map((r: any) => r.event_name as string))];
  return unique;
}

// =========================
// AUTO-EXPIRE: transfer expired shop items → raffles
// Calls the Postgres RPC. Returns count of new raffles created.
// Safe to call on every page load — skips already-transferred items.
// =========================
export async function expireShopItems(): Promise<number> {
  const { data, error } = await supabase.rpc('expire_shop_items');
  if (error) {
    // Log full error so it shows in browser DevTools → Console
    console.error('[expireShopItems] RPC error:', JSON.stringify(error));
    // If the RPC doesn't exist yet, tell the developer clearly
    if (error.code === 'PGRST202' || error.message?.includes('not exist')) {
      console.error('[expireShopItems] The expire_shop_items() function does not exist in Supabase. Run DEBUG_EXPIRE.sql Step 5.');
    }
    return 0;
  }
  console.debug('[expireShopItems] transferred:', data);
  return (data as number) || 0;
}

// Get default raffle ticket price from shop_settings
export async function getDefaultRaffleTicketPrice(): Promise<number> {
  const { data } = await supabase
    .from('shop_settings')
    .select('default_raffle_ticket_price')
    .limit(1)
    .single();
  return data?.default_raffle_ticket_price ?? 10;
}

export async function setDefaultRaffleTicketPrice(price: number): Promise<void> {
  const { error } = await supabase
    .from('shop_settings')
    .update({ default_raffle_ticket_price: price })
    .gt('id', 0);
  if (error) throw error;
}
