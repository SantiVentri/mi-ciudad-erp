import { Database } from '@/utils/supabase/database.types'

export type SortOption = "hora-asc" | "hora-desc" | "cliente-asc" | "cliente-desc";

export type OrderRow = Database['public']['Tables']['orders']['Row']
export type OrderInsert = Database['public']['Tables']['orders']['Insert']
export type OrderUpdate = Database['public']['Tables']['orders']['Update']