"use client";

/**
 * LogiChain AI — Live GPS Tracking Map
 * ======================================
 * react-leaflet MapContainer that subscribes to Supabase Realtime
 * on the `package_location` table to dynamically move a vehicle
 * marker as new GPS coordinates are inserted.
 *
 * NOTE: This component must NEVER be imported directly in a page.
 * Use TrackingMapWrapper.tsx which lazy-loads this via next/dynamic
 * with ssr: false (Leaflet requires the `window` object).
 */

import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
} from "react-leaflet";
import L from "leaflet";
import { createClient } from "@/lib/supabase/client";
import type { PackageLocation, Warehouse } from "@/types/logistics";

// ── Props ────────────────────────────────────────────────────────────────

interface LiveTrackingMapProps {
  /** The package to track in real-time. */
  packageId: number;
  /** Optional tracking number for display in the popup. */
  trackingNumber?: string;
  /** Starting coordinates (if known from last location). */
  initialLocation?: { latitude: number; longitude: number };
  /** Warehouse hubs to display as static markers. */
  warehouses?: Warehouse[];
  /** Map height in pixels. Default: 360. */
  height?: number;
}

// ── Custom Icons ─────────────────────────────────────────────────────────

const vehicleIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 36px; height: 36px;
      background: #059669;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    ">🚚</div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

const warehouseIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 28px; height: 28px;
      background: white;
      border: 2px solid #059669;
      border-radius: 6px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    ">🏭</div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

// ── Default Center (India) ───────────────────────────────────────────────

const DEFAULT_CENTER: L.LatLngExpression = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

// ── Component ────────────────────────────────────────────────────────────

export default function LiveTrackingMap({
  packageId,
  trackingNumber,
  initialLocation,
  warehouses = [],
  height = 360,
}: LiveTrackingMapProps) {
  const [currentPos, setCurrentPos] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialLocation ?? null);

  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // ── Subscribe to Realtime GPS updates ────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    // Fetch the latest known position on mount
    const fetchLatest = async () => {
      const { data } = await supabase
        .from("package_location")
        .select("latitude, longitude, timestamp")
        .eq("package_id", packageId)
        .order("timestamp", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const loc = data[0] as PackageLocation;
        setCurrentPos({ latitude: loc.latitude, longitude: loc.longitude });
        setLastUpdate(loc.timestamp);

        // Pan map to the latest position
        if (mapRef.current) {
          mapRef.current.setView([loc.latitude, loc.longitude], 12);
        }
      }
    };

    fetchLatest();

    // Subscribe to new INSERT events on package_location
    const channel = supabase
      .channel(`gps-track-${packageId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "package_location",
          filter: `package_id=eq.${packageId}`,
        },
        (payload) => {
          const newLoc = payload.new as PackageLocation;
          setCurrentPos({
            latitude: newLoc.latitude,
            longitude: newLoc.longitude,
          });
          setLastUpdate(newLoc.timestamp);

          // Smooth pan to new position
          if (mapRef.current) {
            mapRef.current.flyTo([newLoc.latitude, newLoc.longitude], 13, {
              duration: 1.5,
            });
          }

          // Animate marker movement
          if (markerRef.current) {
            markerRef.current.setLatLng([
              newLoc.latitude,
              newLoc.longitude,
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [packageId]);

  // ── Compute map center ───────────────────────────────────────────────
  const center: L.LatLngExpression = currentPos
    ? [currentPos.latitude, currentPos.longitude]
    : DEFAULT_CENTER;

  const zoom = currentPos ? 12 : DEFAULT_ZOOM;

  return (
    <div
      style={{ height: `${height}px`, width: "100%" }}
      className="rounded-xl overflow-hidden border border-[#E2E8F0] shadow-sm relative"
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Vehicle Marker (real-time position) */}
        {currentPos && (
          <Marker
            position={[currentPos.latitude, currentPos.longitude]}
            icon={vehicleIcon}
            ref={markerRef}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <p style={{ fontWeight: 700, margin: "0 0 4px" }}>
                  🚚{" "}
                  {trackingNumber
                    ? `Package ${trackingNumber}`
                    : `Package #${packageId}`}
                </p>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                  📍 {currentPos.latitude.toFixed(4)},{" "}
                  {currentPos.longitude.toFixed(4)}
                </p>
                {lastUpdate && (
                  <p
                    style={{
                      fontSize: 11,
                      color: "#94a3b8",
                      margin: "4px 0 0",
                    }}
                  >
                    Last update: {new Date(lastUpdate).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Warehouse Hub Markers */}
        {warehouses.map((wh) => (
          <Marker
            key={wh.warehouse_id}
            position={[wh.latitude, wh.longitude]}
            icon={warehouseIcon}
          >
            <Popup>
              <div style={{ minWidth: 140 }}>
                <p style={{ fontWeight: 700, margin: "0 0 4px" }}>
                  🏭 {wh.name}
                </p>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                  {wh.city}, {wh.state}
                </p>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>
                  Load: {wh.current_load?.toLocaleString()} /{" "}
                  {wh.capacity.toLocaleString()}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Accuracy ring around vehicle */}
        {currentPos && (
          <Circle
            center={[currentPos.latitude, currentPos.longitude]}
            radius={500}
            pathOptions={{
              color: "#059669",
              fillColor: "#059669",
              fillOpacity: 0.08,
              weight: 1,
            }}
          />
        )}
      </MapContainer>

      {/* Status Overlay */}
      {!currentPos && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-10 pointer-events-none">
          <div className="text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl">📡</span>
            </div>
            <p className="text-sm font-medium text-slate-500">
              Awaiting GPS signal...
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Live tracking activates when location data is available
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
