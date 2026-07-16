"use client";

/**
 * LogiChain AI — Tracking Map SSR-Safe Wrapper
 * ================================================
 * Leaflet requires the `window` object and crashes during SSR.
 * This thin wrapper uses next/dynamic with ssr:false to lazy-load
 * the LiveTrackingMap component only on the client.
 *
 * Usage in pages:
 *   import TrackingMapWrapper from '@/components/ui/TrackingMapWrapper';
 *   <TrackingMapWrapper packageId={1} warehouses={warehouses} />
 */

import dynamic from "next/dynamic";
import type { Warehouse } from "@/types/logistics";

// ── Dynamic Import (no SSR) ──────────────────────────────────────────────

const LiveTrackingMap = dynamic(
  () => import("@/components/ui/LiveTrackingMap"),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  }
);

// ── Skeleton Loader ──────────────────────────────────────────────────────

function MapSkeleton() {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-slate-50 shadow-sm overflow-hidden animate-fade-in"
      style={{ height: 360 }}
    >
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#059669] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">
            Loading map...
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Wrapper Props ────────────────────────────────────────────────────────

interface TrackingMapWrapperProps {
  packageId: number;
  trackingNumber?: string;
  initialLocation?: { latitude: number; longitude: number };
  warehouses?: Warehouse[];
  height?: number;
}

export default function TrackingMapWrapper(props: TrackingMapWrapperProps) {
  return <LiveTrackingMap {...props} />;
}
