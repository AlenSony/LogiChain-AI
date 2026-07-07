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
      profiles: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          role: 'customer' | 'admin' | 'warehouse_manager' | 'pickup_employee' | 'delivery_employee'
          created_at: string | null
        }
        Insert: {
          id: string
          name: string
          email: string
          phone?: string | null
          role?: 'customer' | 'admin' | 'warehouse_manager' | 'pickup_employee' | 'delivery_employee'
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          role?: 'customer' | 'admin' | 'warehouse_manager' | 'pickup_employee' | 'delivery_employee'
          created_at?: string | null
        }
      }
      warehouses: {
        Row: {
          warehouse_id: number
          name: string
          address: string | null
          city: string | null
          state: string | null
          latitude: number
          longitude: number
          capacity: number
          current_load: number | null
          created_at: string | null
        }
        Insert: {
          warehouse_id?: number
          name: string
          address?: string | null
          city?: string | null
          state?: string | null
          latitude: number
          longitude: number
          capacity: number
          current_load?: number | null
          created_at?: string | null
        }
        Update: {
          warehouse_id?: number
          name?: string
          address?: string | null
          city?: string | null
          state?: string | null
          latitude?: number
          longitude?: number
          capacity?: number
          current_load?: number | null
          created_at?: string | null
        }
      }
      employees: {
        Row: {
          employee_id: number
          user_id: string
          emp_type: 'pickup_agent' | 'warehouse_operator' | 'delivery_agent' | 'route_manager'
          warehouse_id: number | null
          vehicle_id: string | null
          status: string
          joined_date: string
        }
        Insert: {
          employee_id?: number
          user_id: string
          emp_type: 'pickup_agent' | 'warehouse_operator' | 'delivery_agent' | 'route_manager'
          warehouse_id?: number | null
          vehicle_id?: string | null
          status?: string
          joined_date?: string
        }
        Update: {
          employee_id?: number
          user_id?: string
          emp_type?: 'pickup_agent' | 'warehouse_operator' | 'delivery_agent' | 'route_manager'
          warehouse_id?: number | null
          vehicle_id?: string | null
          status?: string
          joined_date?: string
        }
      }
      packages: {
        Row: {
          package_id: number
          user_id: string | null
          tracking_number: string
          weight: number | null
          length: number | null
          width: number | null
          height: number | null
          category: string | null
          fragile: boolean | null
          hazardous: boolean | null
          status: 'pending' | 'pickup_scheduled' | 'picked_up' | 'in_warehouse' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
          source_address: string
          destination_address: string
          pickup_date: string | null
          delivery_date: string | null
          created_at: string | null
        }
        Insert: {
          package_id?: number
          user_id?: string | null
          tracking_number: string
          weight?: number | null
          length?: number | null
          width?: number | null
          height?: number | null
          category?: string | null
          fragile?: boolean | null
          hazardous?: boolean | null
          status?: 'pending' | 'pickup_scheduled' | 'picked_up' | 'in_warehouse' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
          source_address: string
          destination_address: string
          pickup_date?: string | null
          delivery_date?: string | null
          created_at?: string | null
        }
        Update: {
          package_id?: number
          user_id?: string | null
          tracking_number?: string
          weight?: number | null
          length?: number | null
          width?: number | null
          height?: number | null
          category?: string | null
          fragile?: boolean | null
          hazardous?: boolean | null
          status?: 'pending' | 'pickup_scheduled' | 'picked_up' | 'in_warehouse' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
          source_address?: string
          destination_address?: string
          pickup_date?: string | null
          delivery_date?: string | null
          created_at?: string | null
        }
      }
      package_routes: {
        Row: {
          id: number
          package_id: number | null
          warehouse_id: number | null
          sequence_no: number
          arrival_time: string | null
          departure_time: string | null
        }
        Insert: {
          id?: number
          package_id?: number | null
          warehouse_id?: number | null
          sequence_no: number
          arrival_time?: string | null
          departure_time?: string | null
        }
        Update: {
          id?: number
          package_id?: number | null
          warehouse_id?: number | null
          sequence_no?: number
          arrival_time?: string | null
          departure_time?: string | null
        }
      }
      tracking_events: {
        Row: {
          event_id: number
          package_id: number | null
          warehouse_id: number | null
          employee_id: number | null
          status: 'pending' | 'pickup_scheduled' | 'picked_up' | 'in_warehouse' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
          remarks: string | null
          timestamp: string | null
        }
        Insert: {
          event_id?: number
          package_id?: number | null
          warehouse_id?: number | null
          employee_id?: number | null
          status: 'pending' | 'pickup_scheduled' | 'picked_up' | 'in_warehouse' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
          remarks?: string | null
          timestamp?: string | null
        }
        Update: {
          event_id?: number
          package_id?: number | null
          warehouse_id?: number | null
          employee_id?: number | null
          status?: 'pending' | 'pickup_scheduled' | 'picked_up' | 'in_warehouse' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
          remarks?: string | null
          timestamp?: string | null
        }
      }
      package_location: {
        Row: {
          package_id: number
          latitude: number
          longitude: number
          timestamp: string
        }
        Insert: {
          package_id: number
          latitude: number
          longitude: number
          timestamp?: string
        }
        Update: {
          package_id?: number
          latitude?: number
          longitude?: number
          timestamp?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'customer' | 'admin' | 'warehouse_manager' | 'pickup_employee' | 'delivery_employee'
      employee_type: 'pickup_agent' | 'warehouse_operator' | 'delivery_agent' | 'route_manager'
      package_status: 'pending' | 'pickup_scheduled' | 'picked_up' | 'in_warehouse' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
