/**
 * LogiChain AI — Derived Type Aliases & Status Helpers
 * =====================================================
 * Convenience types extracted from the generated Supabase schema
 * to avoid deeply-nested `Database['public']['Tables'][...]` access
 * throughout components.
 */

import type { Database } from './supabase';

// ── Row-Level Type Aliases ───────────────────────────────────────────────

/** Public profile row (extends auth.users). */
export type Profile = Database['public']['Tables']['profiles']['Row'];

/** Physical warehouse / graph node. */
export type Warehouse = Database['public']['Tables']['warehouses']['Row'];

/** Employee fleet asset. */
export type Employee = Database['public']['Tables']['employees']['Row'];

/** Core package / shipment record. */
export type Package = Database['public']['Tables']['packages']['Row'];

/** AI-computed multi-hub route hop. */
export type PackageRoute = Database['public']['Tables']['package_routes']['Row'];

/** Immutable custody-chain audit event. */
export type TrackingEvent = Database['public']['Tables']['tracking_events']['Row'];

/** High-frequency GPS coordinate log entry. */
export type PackageLocation = Database['public']['Tables']['package_location']['Row'];

// ── Enum Types ───────────────────────────────────────────────────────────

export type UserRole = Database['public']['Enums']['user_role'];
export type EmployeeType = Database['public']['Enums']['employee_type'];
export type PackageStatus = Database['public']['Enums']['package_status'];

// ── Status Metadata ──────────────────────────────────────────────────────

export interface StatusMeta {
  label: string;
  emoji: string;
  color: string;       // Tailwind-safe CSS color
  bgColor: string;     // Background color
  borderColor: string; // Border color
}

/**
 * Maps each `package_status` ENUM value to display metadata.
 * Used by the TrackingTimeline, status badges, and other UI components.
 */
export const STATUS_META: Record<PackageStatus, StatusMeta> = {
  pending: {
    label: 'Pending',
    emoji: '🟡',
    color: '#B45309',
    bgColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  pickup_scheduled: {
    label: 'Pickup Scheduled',
    emoji: '📅',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
    borderColor: '#DDD6FE',
  },
  picked_up: {
    label: 'Picked Up',
    emoji: '🚚',
    color: '#2563EB',
    bgColor: '#DBEAFE',
    borderColor: '#BFDBFE',
  },
  in_warehouse: {
    label: 'In Warehouse',
    emoji: '🏭',
    color: '#059669',
    bgColor: '#D1FAE5',
    borderColor: '#A7F3D0',
  },
  in_transit: {
    label: 'In Transit',
    emoji: '✈️',
    color: '#0891B2',
    bgColor: '#CFFAFE',
    borderColor: '#A5F3FC',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    emoji: '🛵',
    color: '#D97706',
    bgColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  delivered: {
    label: 'Delivered',
    emoji: '✅',
    color: '#059669',
    bgColor: '#D1FAE5',
    borderColor: '#A7F3D0',
  },
  cancelled: {
    label: 'Cancelled',
    emoji: '❌',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
};

/**
 * Ordered list of statuses representing the normal package lifecycle.
 * Used by the TrackingTimeline to determine step completion state.
 */
export const STATUS_ORDER: PackageStatus[] = [
  'pending',
  'pickup_scheduled',
  'picked_up',
  'in_warehouse',
  'in_transit',
  'out_for_delivery',
  'delivered',
];

/**
 * Get the index of a status in the lifecycle order.
 * Returns -1 for 'cancelled' (not part of normal flow).
 */
export function getStatusIndex(status: PackageStatus): number {
  return STATUS_ORDER.indexOf(status);
}

/**
 * Format an ISO timestamp string into a human-readable relative or
 * absolute format depending on recency.
 */
export function formatTimestamp(isoString: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
