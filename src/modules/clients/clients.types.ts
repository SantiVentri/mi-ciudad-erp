import { Database } from '@/utils/supabase/database.types'

export type ClientRow = Database['public']['Tables']['clients']['Row']
export type ClientInsert = Database['public']['Tables']['clients']['Insert']
export type ClientUpdate = Database['public']['Tables']['clients']['Update']

export type ClientFormValues = {
  name: string;
  email: string;
  phone: string;
  street: string;
  number: string;
  city: string;
  province: string;
  observations?: string;
  latitude?: string;
  longitude?: string;
};