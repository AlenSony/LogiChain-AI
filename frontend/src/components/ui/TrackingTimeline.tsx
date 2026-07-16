"use client";

/**
 * LogiChain AI — Tracking Timeline (Vertical Stepper)
 * =====================================================
 * Visualizes the custody-chain audit log from the tracking_events
 * table as a vertical stepper. Clearly shows ENUM state changes
 * (e.g., in_warehouse → in_transit) with visual differentiation:
 *
 *   ● Completed steps: Jade green filled circle + solid connector
 *   ◉ Current step:   Pulsing green dot with ring animation
 *   ○ Future steps:   Gray dashed circle + dashed connector
 */

import { useMemo } from "react";
import type { TrackingEvent, PackageStatus } from "@/types/logistics";
import { STATUS_META, formatTimestamp } from "@/types/logistics";

// ── Props ────────────────────────────────────────────────────────────────

interface TrackingTimelineProps {
  /** Tracking events from the audit log, in chronological order. */
  events: TrackingEvent[];
  /** Current package status — determines which step is "active". */
  currentStatus: PackageStatus;
}

// ── Component ────────────────────────────────────────────────────────────

export default function TrackingTimeline({
  events,
  currentStatus,
}: TrackingTimelineProps) {
  // Deduplicate events by status (keep latest per status)
  const dedupedEvents = useMemo(() => {
    const seen = new Map<string, TrackingEvent>();
    for (const event of events) {
      seen.set(event.status, event);
    }
    return Array.from(seen.values());
  }, [events]);

  if (dedupedEvents.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-slate-400">No tracking events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-8">
      {dedupedEvents.map((event, index) => {
        const isLast = index === dedupedEvents.length - 1;
        const isCurrent = event.status === currentStatus;
        const meta = STATUS_META[event.status] ?? STATUS_META.pending;

        return (
          <div
            key={event.event_id}
            className="relative pb-6 last:pb-0 animate-timeline-slide"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            {/* Connector Line */}
            {!isLast && (
              <div
                className="absolute left-[-20px] top-[28px] w-[2px]"
                style={{
                  height: "calc(100% - 12px)",
                  background: isCurrent
                    ? "linear-gradient(to bottom, #059669 50%, #e2e8f0 50%)"
                    : "#059669",
                }}
              />
            )}

            {/* Step Indicator */}
            <div
              className="absolute left-[-28px] top-[4px] flex items-center justify-center"
              style={{ width: 18, height: 18 }}
            >
              {isCurrent ? (
                /* Active: Pulsing ring */
                <div
                  className="animate-pulse-ring rounded-full"
                  style={{
                    width: 14,
                    height: 14,
                    background: "#059669",
                    border: "2px solid white",
                    boxShadow: "0 0 0 2px #059669",
                  }}
                />
              ) : (
                /* Completed: Solid filled circle with checkmark */
                <div
                  className="rounded-full flex items-center justify-center"
                  style={{
                    width: 16,
                    height: 16,
                    background: "#059669",
                    border: "2px solid white",
                    boxShadow: "0 0 0 1px #d1fae5",
                  }}
                >
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Event Content */}
            <div
              className={`
                rounded-lg border px-4 py-3 transition-all duration-200
                ${
                  isCurrent
                    ? "bg-white border-[#059669]/30 shadow-sm"
                    : "bg-slate-50/50 border-[#E2E8F0] hover:bg-white hover:shadow-sm"
                }
              `}
            >
              {/* Header Row */}
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      background: meta.bgColor,
                      color: meta.color,
                      border: `1px solid ${meta.borderColor}`,
                    }}
                  >
                    <span>{meta.emoji}</span>
                    {meta.label}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#059669] bg-[#D1FAE5] px-1.5 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </div>
                <time className="text-[11px] text-slate-400 font-medium tabular-nums whitespace-nowrap">
                  {formatTimestamp(event.timestamp)}
                </time>
              </div>

              {/* Remarks */}
              {event.remarks && (
                <p className="text-sm text-slate-600 leading-relaxed mt-1">
                  {event.remarks}
                </p>
              )}

              {/* Metadata Row */}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                {event.warehouse_id && (
                  <span className="flex items-center gap-1">
                    <span>🏭</span> Hub #{event.warehouse_id}
                  </span>
                )}
                {event.employee_id && (
                  <span className="flex items-center gap-1">
                    <span>👤</span> Agent #{event.employee_id}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
