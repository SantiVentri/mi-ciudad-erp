export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      clients: {
        Row: {
          city: string
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          number: string
          observations: string | null
          phone: string
          province: string
          street: string
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          number: string
          observations?: string | null
          phone: string
          province: string
          street: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          number?: string
          observations?: string | null
          phone?: string
          province?: string
          street?: string
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          used_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          href: string | null
          id: string
          message: string
          metadata: Json | null
          seen: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          href?: string | null
          id?: string
          message: string
          metadata?: Json | null
          seen?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          href?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          seen?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_details: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_details_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          arrival_date: string
          client_id: string
          created_at: string
          id: string
          state: string
          updated_at: string
        }
        Insert: {
          arrival_date: string
          client_id: string
          created_at?: string
          id?: string
          state?: string
          updated_at?: string
        }
        Update: {
          arrival_date?: string
          client_id?: string
          created_at?: string
          id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          display_name: string
          email: string
          first_name: string
          id: string
          is_active: boolean | null
          last_name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          display_name: string
          email: string
          first_name: string
          id: string
          is_active?: boolean | null
          last_name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          display_name?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean | null
          last_name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          co_driver_id: string | null
          created_at: string
          driver_id: string
          id: string
          route_date: string
          route_number: number
          state: string
          trip_number: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          co_driver_id?: string | null
          created_at?: string
          driver_id: string
          id?: string
          route_date: string
          route_number?: number
          state?: string
          trip_number?: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          co_driver_id?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          route_date?: string
          route_number?: number
          state?: string
          trip_number?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_co_driver_id_fkey"
            columns: ["co_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          created_at: string
          id: string
          order_id: string
          route_id: string
          state: string
          visit_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          route_id: string
          state?: string
          visit_order: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          route_id?: string
          state?: string
          visit_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "stops_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          model: string | null
          patent: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          model?: string | null
          patent: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          model?: string | null
          patent?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_today: { Args: never; Returns: string }
      assert_orders_assignable: {
        Args: { p_date: string; p_order_ids: string[]; p_route_id?: string }
        Returns: undefined
      }
      assert_route_slot_free: {
        Args: {
          p_co_driver_id: string
          p_date: string
          p_driver_id: string
          p_exclude_route_id?: string
          p_trip: number
          p_vehicle_id: string
        }
        Returns: undefined
      }
      cancel_order: {
        Args: { p_order_id: string; p_release?: boolean }
        Returns: undefined
      }
      cancel_route: { Args: { p_route_id: string }; Returns: string }
      change_orders_date: {
        Args: {
          p_new_date: string
          p_order_ids: string[]
          p_reactivate?: boolean
          p_release?: boolean
        }
        Returns: undefined
      }
      create_route_with_stops:
        | {
            Args: {
              p_co_driver_id: string
              p_driver_id: string
              p_order_ids: string[]
              p_route_date: string
              p_trip_number: number
              p_vehicle_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_driver_id: string
              p_order_ids: string[]
              p_route_date: string
              p_vehicle_id: string
            }
            Returns: string
          }
      create_routes_batch: {
        Args: { p_route_date: string; p_routes: Json }
        Returns: string[]
      }
      delete_route: { Args: { p_route_id: string }; Returns: undefined }
      edit_route: {
        Args: {
          p_co_driver_id: string
          p_driver_id: string
          p_new_date: string
          p_route_id: string
          p_vehicle_id: string
        }
        Returns: number
      }
      get_drivers: {
        Args: never
        Returns: {
          avatar: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          phone: string
        }[]
      }
      is_active_driver: { Args: { p_user_id: string }; Returns: boolean }
      is_route_slot_free: {
        Args: {
          p_co_driver_id: string
          p_date: string
          p_driver_id: string
          p_exclude_route_id?: string
          p_trip: number
          p_vehicle_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_driver: { Args: never; Returns: boolean }
      move_route_date: {
        Args: { p_new_date: string; p_route_id: string }
        Returns: undefined
      }
      notify_route_drivers: {
        Args: { p_message: string; p_route_id: string; p_type: string }
        Returns: undefined
      }
      notify_user: {
        Args: {
          p_href?: string
          p_message: string
          p_metadata?: Json
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      release_order_from_route: {
        Args: { p_order_id: string }
        Returns: string
      }
      set_route_stops: {
        Args: { p_order_ids: string[]; p_route_id: string }
        Returns: undefined
      }
      update_route_assignment: {
        Args: {
          p_co_driver_id: string
          p_driver_id: string
          p_route_id: string
          p_vehicle_id: string
        }
        Returns: undefined
      }
      validate_invitation: {
        Args: { p_token: string }
        Returns: {
          email: string
          is_valid: boolean
          role: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
