export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          pin: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          pin: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          pin?: string
          color?: string
          created_at?: string
        }
      }
      rounds: {
        Row: {
          id: string
          state: string
          created_at: string
          locked_at: string | null
          locked_by_user_id: string | null
          receipt_uploaded_at: string | null
          receipt_path: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          settled_at: string | null
          total_amount: number
          note: string | null
        }
        Insert: {
          id?: string
          state?: string
          created_at?: string
          locked_at?: string | null
          locked_by_user_id?: string | null
          receipt_uploaded_at?: string | null
          receipt_path?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          settled_at?: string | null
          total_amount?: number
          note?: string | null
        }
        Update: {
          id?: string
          state?: string
          created_at?: string
          locked_at?: string | null
          locked_by_user_id?: string | null
          receipt_uploaded_at?: string | null
          receipt_path?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          settled_at?: string | null
          total_amount?: number
          note?: string | null
        }
      }
      items: {
        Row: {
          id: string
          round_id: string
          name: string
          quantity: number
          estimated_price: number | null
          status: string
          requested_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          is_purchased: boolean
          is_in_cart: boolean
        }
        Insert: {
          id?: string
          round_id: string
          name: string
          quantity?: number
          estimated_price?: number | null
          status?: string
          requested_by_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          is_purchased?: boolean
          is_in_cart?: boolean
        }
        Update: {
          id?: string
          round_id?: string
          name?: string
          quantity?: number
          estimated_price?: number | null
          status?: string
          requested_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          is_purchased?: boolean
          is_in_cart?: boolean
        }
      }
      receipt_lines: {
        Row: {
          id: string
          round_id: string
          line_number: number
          description: string
          quantity: number
          unit_price: number
          total_price: number
          matched_item_id: string | null
          is_ignored: boolean
        }
        Insert: {
          id?: string
          round_id: string
          line_number: number
          description: string
          quantity: number
          unit_price: number
          total_price: number
          matched_item_id?: string | null
          is_ignored?: boolean
        }
        Update: {
          id?: string
          round_id?: string
          line_number?: number
          description?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          matched_item_id?: string | null
          is_ignored?: boolean
        }
      }
      allocations: {
        Row: {
          id: string
          item_id: string
          user_id: string
          amount: number
          percentage: number
        }
        Insert: {
          id?: string
          item_id: string
          user_id: string
          amount: number
          percentage?: number
        }
        Update: {
          id?: string
          item_id?: string
          user_id?: string
          amount?: number
          percentage?: number
        }
      }
    }
  }
}
