export interface User {
  id: string;
  name: string;
  pin: string;
  color: string;
  created_at: string;
}

export interface Round {
  id: string;
  state: 'OPEN' | 'LOCKED' | 'REVIEW' | 'SETTLED';
  created_at: string;
  locked_at: string | null;
  locked_by_user_id: string | null;
  receipt_uploaded_at: string | null;
  receipt_path: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  settled_at: string | null;
  total_amount: number;
  note: string | null;
}

export interface Item {
  id: string;
  round_id: string;
  name: string;
  quantity: number;
  estimated_price: number | null;
  status: 'active' | 'requested' | 'purchased';
  requested_by_user_id: string | null;
  created_at: string;
  created_by_user_id: string;
  is_purchased: boolean;
  is_in_cart: boolean;
}

export interface ReceiptLine {
  id: string;
  round_id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  matched_item_id: string | null;
  is_ignored: boolean;
}

export interface Allocation {
  id: string;
  item_id: string;
  user_id: string;
  amount: number;
  percentage: number;
}

export interface PresenceState {
  user_id: string;
  user_name: string;
  color: string;
}
