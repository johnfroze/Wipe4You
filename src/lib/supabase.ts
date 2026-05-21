import { createClient } from '@supabase/supabase-js';
import type { Member, Auction, ShopItem, ShopTransaction } from '@/types';

const SUPABASE_URL = 'https://huvgvbppxllgrqtpcaxx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dmd2YnBweGxsZ3JxdHBjYXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTE4NTEsImV4cCI6MjA5NDgyNzg1MX0.5xBd2gB8sycVab4FOhcnXl6Nrql1ZAmSsfOgQGfMY54';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth helpers
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInWithDiscord() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Member helpers
export async function getMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('dkp', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMemberByDiscordId(discordId: string): Promise<Member | null> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('discord_id', discordId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertMember(member: Partial<Member>) {
  const { error } = await supabase.from('members').upsert(member, {
    onConflict: 'discord_id',
  });
  if (error) throw error;
}

export async function updateMemberDkp(id: string, dkp: number) {
  const { error } = await supabase.from('members').update({ dkp }).eq('id', id);
  if (error) throw error;
}

export async function updateMemberRole(id: string, role: Member['role']) {
  const { error } = await supabase.from('members').update({ role }).eq('id', id);
  if (error) throw error;
}

export async function updateMemberUsername(id: string, username: string) {
  const { error } = await supabase.from('members').update({ username }).eq('id', id);
  if (error) throw error;
}

export async function deleteMember(id: string) {
  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) throw error;
}

// Auction helpers
export async function getAuctions(): Promise<Auction[]> {
  const { data, error } = await supabase
    .from('auctions')
    .select('*')
    .order('id', { ascending: false });
  if (error) throw error;
  return (data || []).map((a) => ({
    ...a,
    currentBid: a.current_bid,
    highestBidder: a.highest_bidder,
    endTime: a.end_time,
  })) as Auction[];
}

export async function createAuction(auction: Partial<Auction>) {
  const { error } = await supabase.from('auctions').insert({
    id: Date.now(),
    item: auction.item,
    image: auction.image,
    current_bid: auction.current_bid,
    increment: auction.increment,
    highest_bidder: 'None',
    end_time: auction.end_time,
    ended: false,
    history: [],
  });
  if (error) throw error;
}

export async function updateAuction(id: number, updates: Partial<Auction>) {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.current_bid !== undefined) dbUpdates.current_bid = updates.current_bid;
  if (updates.highest_bidder !== undefined) dbUpdates.highest_bidder = updates.highest_bidder;
  if (updates.history !== undefined) dbUpdates.history = updates.history;
  if (updates.end_time !== undefined) dbUpdates.end_time = updates.end_time;
  if (updates.ended !== undefined) dbUpdates.ended = updates.ended;

  const { error } = await supabase.from('auctions').update(dbUpdates).eq('id', id);
  if (error) throw error;
}

export async function deleteAuction(id: number) {
  const { error } = await supabase.from('auctions').delete().eq('id', id);
  if (error) throw error;
}

// Storage helpers
export async function uploadAuctionImage(file: File): Promise<string> {
  const fileName = `${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('auction-images').upload(fileName, file, {
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('auction-images').getPublicUrl(fileName);
  return data.publicUrl;
}

// Shop Item helpers
export async function getShopItems(): Promise<ShopItem[]> {
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createShopItem(item: Partial<ShopItem>) {
  const { error } = await supabase.from('shop_items').insert({
    name: item.name,
    description: item.description,
    image_url: item.image_url,
    price: item.price,
    total_stock: item.total_stock,
    current_stock: item.total_stock,
    created_by: item.created_by,
    is_active: true,
  });
  if (error) throw error;
}

export async function updateShopItem(id: number, updates: Partial<ShopItem>) {
  const { error } = await supabase.from('shop_items').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteShopItem(id: number) {
  const { error } = await supabase.from('shop_items').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadShopImage(file: File): Promise<string> {
  const fileName = `${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('shop-images').upload(fileName, file, {
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('shop-images').getPublicUrl(fileName);
  return data.publicUrl;
}

// Shop Transaction helpers
export async function getShopTransactions(): Promise<ShopTransaction[]> {
  const { data, error } = await supabase
    .from('shop_transactions')
    .select('*, buyer:members(*), item:shop_items(*)')
    .order('purchase_timestamp', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMyTransactions(buyerId: string): Promise<ShopTransaction[]> {
  const { data, error } = await supabase
    .from('shop_transactions')
    .select('*, item:shop_items(*)')
    .eq('buyer_id', buyerId)
    .order('purchase_timestamp', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createTransaction(transaction: Partial<ShopTransaction>) {
  const { error } = await supabase.from('shop_transactions').insert({
    buyer_id: transaction.buyer_id,
    item_id: transaction.item_id,
    quantity: transaction.quantity,
    total_price: transaction.total_price,
    distribution_status: 'pending',
  });
  if (error) throw error;
}

export async function distributeTransaction(id: number, distributedBy: string) {
  const { error } = await supabase
    .from('shop_transactions')
    .update({
      distribution_status: 'distributed',
      distributed_by: distributedBy,
      distributed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTransaction(id: number) {
  const { error } = await supabase.from('shop_transactions').delete().eq('id', id);
  if (error) throw error;
}
