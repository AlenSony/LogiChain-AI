"use client";

/**
 * LogiChain AI — Warehouse Capacity Heatmap
 * ============================================
 * Dashboard component for the Warehouse Manager portal that
 * visualizes capacity ratios across all warehouse nodes.
 *
 * Dynamic color-coding:
 *   < 50%  → Emerald/green gradient
 *   50–70% → Amber/yellow
 *   70–90% → Orange
 *   ≥ 90%  → Red with pulse animation (critical alert)
 *
 * Subscribes to Supabase Realtime on the `warehouses` table
 * to reflect load changes live.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Warehouse } from "@/types/logistics";

// ── Props ────────────────────────────────────────────────────────────────

interface WarehouseHeatmapProps {
  /** Initial warehouse data (fetched server-side). */
  warehouses: Warehouse[];
}

// ── Color Utilities ──────────────────────────────────────────────────────

function getHeatColor(ratio: number): {
  bar: string;
  bg: string;
  border: string;
  text: string;
  label: string;
} {
  if (ratio >= 0.9) {
    return {
      bar: "linear-gradient(90deg, #EF4444, #DC2626)",
      bg: "#FEF2F2",
      border: "#FECACA",
      text: "#DC2626",
      label: "CRITICAL",
    };
  }
  if (ratio >= 0.7) {
    return {
      bar: "linear-gradient(90deg, #F97316, #EA580C)",
      bg: "#FFF7ED",
      border: "#FED7AA",
      text: "#EA580C",
      label: "HIGH",
    };
  }
  if (ratio >= 0.5) {
    return {
      bar: "linear-gradient(90deg, #F59E0B, #D97706)",
      bg: "#FFFBEB",
      border: "#FDE68A",
      text: "#D97706",
      label: "MODERATE",
    };
  }
  return {
    bar: "linear-gradient(90deg, #10B981, #059669)",
    bg: "#F0FDF4",
    border: "#A7F3D0",
    text: "#059669",
    label: "NORMAL",
  };
}

// ── Component ────────────────────────────────────────────────────────────

export default function WarehouseHeatmap({
  warehouses: initialWarehouses,
}: WarehouseHeatmapProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);

  // ── Subscribe to Realtime warehouse updates ──────────────────────────
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("warehouse-heatmap")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "warehouses",
        },
        (payload) => {
          const updated = payload.new as Warehouse;
          setWarehouses((prev) =>
            prev.map((wh) =>
              wh.warehouse_id === updated.warehouse_id ? updated : wh
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Sort: critical first ─────────────────────────────────────────────
  const sorted = [...warehouses].sort((a, b) => {
    const ratioA = (a.current_load ?? 0) / a.capacity;
    const ratioB = (b.current_load ?? 0) / b.capacity;
    return ratioB - ratioA;
  });

  // ── Compute system totals ────────────────────────────────────────────
  const totalCapacity = warehouses.reduce((sum, wh) => sum + wh.capacity, 0);
  const totalLoad = warehouses.reduce(
    (sum, wh) => sum + (wh.current_load ?? 0),
    0
  );
  const systemRatio = totalCapacity > 0 ? totalLoad / totalCapacity : 0;
  const systemColor = getHeatColor(systemRatio);

  return (
    <div className="space-y-4">
      {/* System-wide Overview Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              System Capacity Overview
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              All {warehouses.length} nodes • Real-time
            </p>
          </div>
          <div className="text-right">
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: systemColor.text }}
            >
              {Math.round(systemRatio * 100)}%
            </span>
            <p className="text-xs text-slate-400">Aggregate</p>
          </div>
        </div>
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className="h-full rounded-full heatmap-bar"
            style={{
              width: `${Math.min(systemRatio * 100, 100)}%`,
              background: systemColor.bar,
            }}
          />
        </div>
        <div className="flex justify-between items-center mt-2 text-xs text-slate-400">
          <span>{totalLoad.toLocaleString()} units loaded</span>
          <span>{totalCapacity.toLocaleString()} total capacity</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sorted.map((wh) => {
          const load = wh.current_load ?? 0;
          const ratio = wh.capacity > 0 ? load / wh.capacity : 0;
          const color = getHeatColor(ratio);
          const isCritical = ratio >= 0.9;
          const available = wh.capacity - load;

          return (
            <div
              key={wh.warehouse_id}
              className={`
                bg-white border rounded-xl p-4 shadow-sm transition-all duration-300
                hover:shadow-md hover:scale-[1.02]
                ${isCritical ? "heatmap-critical border-red-200" : "border-[#E2E8F0]"}
              `}
              style={{ borderLeftWidth: 4, borderLeftColor: color.text }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-800 leading-tight">
                    {wh.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {wh.city}, {wh.state}
                  </p>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: color.bg,
                    color: color.text,
                    border: `1px solid ${color.border}`,
                  }}
                >
                  {color.label}
                </span>
              </div>

              {/* Capacity Bar */}
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full heatmap-bar"
                  style={{
                    width: `${Math.min(ratio * 100, 100)}%`,
                    background: color.bar,
                  }}
                />
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between">
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: color.text }}
                >
                  {Math.round(ratio * 100)}%
                </span>
                <div className="text-right text-[11px] text-slate-400">
                  <p>
                    {load.toLocaleString()} / {wh.capacity.toLocaleString()}
                  </p>
                  <p
                    className="font-medium"
                    style={{
                      color: available < 5000 ? color.text : "#64748B",
                    }}
                  >
                    {available.toLocaleString()} available
                  </p>
                </div>
              </div>

              {/* Critical Alert */}
              {isCritical && (
                <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-[11px] font-semibold text-red-700 flex items-center gap-1">
                    <span className="animate-pulse-dot">🔴</span>
                    Capacity critical — AI rerouting active
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
