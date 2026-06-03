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

export interface AttendanceLog {
  id: number;
  member_id: string;
  event_id: number | null;
  event_name: string;
  dkp_awarded: number;
  recorded_at: string;
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
  expires_at: string | null;   // ISO timestamp, null = never expires
}

// ── Raffle ───────────────────────────────────────────────
export interface Raffle {
  id: number;
  item_id: number | null;
  item_name: string;
  item_image: string | null;
  ticket_price: number;
  max_tickets: number | null;
  tickets_sold: number;
  status: 'open' | 'drawing' | 'completed' | 'cancelled';
  winner_id: string | null;
  winner_name: string | null;
  draw_at: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

export interface RaffleEntry {
  id: number;
  raffle_id: number;
  member_id: string;
  member_name: string;
  tickets: number;
  total_cost: number;
  entered_at: string;
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

// ── New: DKP change log ──────────────────────────────────
export interface DkpLog {
  id: number;
  member_id: string;
  member_name: string;
  amount: number;        // positive = add, negative = remove
  reason: string;
  admin_name: string;
  dkp_before: number;
  dkp_after: number;
  created_at: string;
}

// ── New: Guild announcements ─────────────────────────────
export interface Announcement {
  id: number;
  title: string;
  body: string;
  author_name: string;
  pinned: boolean;
  created_at: string;
}

// ── New: Member profile (aggregated view) ────────────────
export interface MemberProfile {
  member: Member;
  dkpLogs: DkpLog[];
  attendanceLogs: AttendanceLog[];
  auctionWins: Auction[];
  shopPurchases: ShopTransaction[];
}
