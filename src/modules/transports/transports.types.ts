import { Database } from '@/utils/supabase/database.types'

export type VehicleRow = Database['public']['Tables']['vehicles']['Row']
export type VehicleInsert = Database['public']['Tables']['vehicles']['Insert']
export type VehicleUpdate = Database['public']['Tables']['vehicles']['Update']

export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type InvitationInsert = Database['public']['Tables']['invitations']['Insert']

export type Driver = Pick<
  ProfileRow,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'is_active' | 'created_at'
>

export type VehicleFormValues = {
  patent: string
}

export type DriverInviteFormValues = {
  email: string
}