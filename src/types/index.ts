export type MemberRole = 'leader' | 'elder' | 'member';

export interface Member {
  id: string;
  discord_id: string;
  username: string;
  avatar: string;
  role: MemberRole;
  dkp: number;
  attendance: number;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceEvent {
  id: number;
  name: string;
  dkp: number;
}

export interface Auction {
  id: number;
  item: string;
  image: string | null;
  current_bid: number;
  increment: number;
  highest_bidder: string;
  end_time: number;
  ended: boolean;
  history: BidHistoryEntry[];
  created_at?: string;
}

export interface BidHistoryEntry {
  user: string;
  bid: number;
  timestamp?: string;
}

export interface ShopItem {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  total_stock: number;
  current_stock: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface ShopTransaction {
  id: number;
  buyer_id: string;
  item_id: number;
  quantity: number;
  total_price: number;
  purchase_timestamp: string;
  distribution_status: 'pending' | 'distributed';
  distributed_by: string | null;
  distributed_at: string | null;
  buyer?: Member;
  item?: ShopItem;
}

export interface AppUser {
  id: string;
  email?: string;
  user_metadata: {
    avatar_url?: string;
    full_name?: string;
    custom_claims?: {
      global_name?: string;
    };
  };
}

export interface CurrentUser {
  user: AppUser;
  member: Member;
}
