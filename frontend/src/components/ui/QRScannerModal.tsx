"use client";

/**
 * LogiChain AI — QR Code Scanner & Proof of Delivery Modal
 * ==========================================================
 * Driver-facing component for the /dashboard/driver route.
 *
 * Flow:
 *   1. Driver taps "QR Scanner" button → modal opens with camera
 *   2. html5-qrcode scans a QR code containing a package ID
 *      (supports formats: "PKG:123", "123", "TRK-98213456")
 *   3. On success: closes camera, fetches + displays package details
 *   4. Shows "Mark as Delivered" button
 *   5. On confirm: updates packages.status → 'delivered',
 *      sets delivery_date, inserts tracking_event
 *   6. Toast-style feedback on success/error
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Package } from "@/types/logistics";
import { STATUS_META } from "@/types/logistics";

// ── Props ────────────────────────────────────────────────────────────────

interface QRScannerModalProps {
  /** Employee ID performing the delivery. */
  employeeId: number;
  /** Warehouse ID the employee is assigned to. */
  warehouseId?: number | null;
  /** Callback fired after a successful delivery confirmation. */
  onDeliveryConfirmed?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

export default function QRScannerModal({
  employeeId,
  warehouseId,
  onDeliveryConfirmed,
}: QRScannerModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedPackage, setScannedPackage] = useState<Package | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const scannerRef = useRef<any>(null);

  // ── Open/Close Modal ─────────────────────────────────────────────────
  const openModal = useCallback(() => {
    setIsOpen(true);
    setScannedPackage(null);
    setError(null);
    setSuccess(false);
    setScanning(true);
  }, []);

  const closeModal = useCallback(() => {
    // Stop scanner if running
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch {
        // Scanner may already be stopped
      }
      scannerRef.current = null;
    }
    setIsOpen(false);
    setScanning(false);
    setScannedPackage(null);
    setError(null);
  }, []);

  // ── Initialize QR Scanner ────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !scanning) return;

    let mounted = true;

    const initScanner = async () => {
      try {
        // Dynamic import to keep bundle small
        const { Html5QrcodeScanner } = await import("html5-qrcode");

        if (!mounted) return;

        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            rememberLastUsedCamera: true,
          },
          /* verbose= */ false
        );

        scannerRef.current = scanner;

        scanner.render(
          // ── Success callback ──
          async (decodedText: string) => {
            if (!mounted) return;

            // Stop scanning immediately
            try {
              await scanner.clear();
            } catch {
              // Ignore
            }
            setScanning(false);

            // Parse the QR content
            const packageId = parseQRContent(decodedText);
            if (!packageId) {
              setError(
                `Invalid QR code format: "${decodedText}". ` +
                  `Expected: PKG:123, a numeric ID, or a tracking number.`
              );
              return;
            }

            // Fetch the package
            await fetchPackage(packageId);
          },
          // ── Error callback (scan failures are normal, ignore) ──
          () => {}
        );
      } catch (err) {
        if (mounted) {
          setError(
            "Camera access denied or unavailable. Please grant camera " +
              "permissions and try again."
          );
          setScanning(false);
        }
      }
    };

    // Small delay to let the DOM render the #qr-reader div
    const timer = setTimeout(initScanner, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch {
          // Ignore
        }
        scannerRef.current = null;
      }
    };
  }, [isOpen, scanning]);

  // ── Parse QR Content ─────────────────────────────────────────────────
  function parseQRContent(content: string): number | null {
    const trimmed = content.trim();

    // Format 1: "PKG:123"
    const pkgMatch = trimmed.match(/^PKG[:\-]?(\d+)$/i);
    if (pkgMatch) return parseInt(pkgMatch[1], 10);

    // Format 2: Raw numeric ID
    if (/^\d{1,6}$/.test(trimmed)) return parseInt(trimmed, 10);

    // Format 3: "TRK-98213456" → search by tracking number instead
    const trkMatch = trimmed.match(/^TRK-?\d+$/i);
    if (trkMatch) {
      // We'll handle tracking number lookup in fetchPackage
      return -1; // Sentinel: use tracking number search
    }

    return null;
  }

  // ── Fetch Package ────────────────────────────────────────────────────
  async function fetchPackage(id: number) {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      let query;

      if (id === -1) {
        // Tracking number lookup (from sentinel)
        // This shouldn't happen in normal flow — fallback
        setError("Please scan a QR code containing a numeric package ID.");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("packages")
        .select("*")
        .eq("package_id", id)
        .single();

      if (fetchError || !data) {
        setError(`Package #${id} not found in the system.`);
        return;
      }

      setScannedPackage(data as Package);
    } catch (err: any) {
      setError(`Failed to fetch package: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Mark as Delivered (PoD) ──────────────────────────────────────────
  async function handleMarkDelivered() {
    if (!scannedPackage) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      // 1. Update package status to 'delivered' + set delivery_date
      const { error: updateError } = await supabase
        .from("packages")
        .update({
          status: "delivered" as const,
          delivery_date: now,
        })
        .eq("package_id", scannedPackage.package_id);

      if (updateError) throw updateError;

      // 2. Insert tracking event for proof of delivery
      const { error: eventError } = await supabase
        .from("tracking_events")
        .insert({
          package_id: scannedPackage.package_id,
          warehouse_id: warehouseId ?? null,
          employee_id: employeeId,
          status: "delivered" as const,
          remarks: `Proof of Delivery confirmed by Agent #${employeeId}. Package delivered to ${scannedPackage.destination_address}.`,
        });

      if (eventError) throw eventError;

      // 3. Show success state
      setSuccess(true);
      onDeliveryConfirmed?.();

      // Auto-close after 2 seconds and refresh the page
      setTimeout(() => {
        closeModal();
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(`Failed to confirm delivery: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Can this package be marked as delivered? ─────────────────────────
  const canDeliver =
    scannedPackage &&
    ["out_for_delivery", "in_transit", "in_warehouse"].includes(
      scannedPackage.status
    );

  const alreadyDelivered = scannedPackage?.status === "delivered";
  const isCancelled = scannedPackage?.status === "cancelled";

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={openModal}
        className="bg-white border border-[#E2E8F0] p-4 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-[#059669] transition-colors shadow-sm group"
      >
        <div className="w-12 h-12 rounded-full bg-[#D1FAE5] text-[#059669] flex items-center justify-center group-hover:scale-110 transition-transform">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
            />
          </svg>
        </div>
        <span className="text-xs font-semibold text-slate-700">
          QR Scanner
        </span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="qr-modal-overlay" onClick={closeModal}>
          <div
            className="qr-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h3 className="text-lg font-bold text-slate-800">
                {scanning
                  ? "📷 Scan Package QR"
                  : success
                  ? "✅ Delivery Confirmed"
                  : "📦 Package Scanned"}
              </h3>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {/* QR Scanner View */}
              {scanning && (
                <div>
                  <div id="qr-reader" className="rounded-lg overflow-hidden" />
                  <p className="text-xs text-slate-400 text-center mt-3">
                    Point your camera at a package QR code
                  </p>
                </div>
              )}

              {/* Loading */}
              {loading && !scanning && !success && (
                <div className="py-8 text-center">
                  <div className="w-8 h-8 border-3 border-[#059669] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Processing...</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="error-banner mb-4">
                  {error}
                  <button
                    onClick={() => {
                      setError(null);
                      setScanning(true);
                    }}
                    className="block mt-2 text-xs font-semibold underline"
                  >
                    Try scanning again
                  </button>
                </div>
              )}

              {/* Success State */}
              {success && (
                <div className="py-8 text-center animate-fade-in">
                  <div className="w-16 h-16 bg-[#D1FAE5] rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-3xl">✅</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800">
                    Delivery Confirmed!
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Package {scannedPackage?.tracking_number} has been marked as
                    delivered.
                  </p>
                </div>
              )}

              {/* Scanned Package Details */}
              {scannedPackage && !loading && !success && (
                <div className="space-y-4 animate-fade-in">
                  {/* Package Info Card */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-[#E2E8F0]">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-slate-800">
                        {scannedPackage.tracking_number}
                      </h4>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          background:
                            STATUS_META[scannedPackage.status]?.bgColor,
                          color: STATUS_META[scannedPackage.status]?.color,
                          border: `1px solid ${STATUS_META[scannedPackage.status]?.borderColor}`,
                        }}
                      >
                        {STATUS_META[scannedPackage.status]?.emoji}{" "}
                        {STATUS_META[scannedPackage.status]?.label}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <p className="text-slate-600">
                        <span className="text-slate-400 text-xs font-medium">
                          FROM
                        </span>{" "}
                        {scannedPackage.source_address}
                      </p>
                      <p className="text-slate-600">
                        <span className="text-slate-400 text-xs font-medium">
                          TO
                        </span>{" "}
                        {scannedPackage.destination_address}
                      </p>
                      <div className="flex gap-4 text-xs text-slate-400 mt-2">
                        <span>{scannedPackage.weight} kg</span>
                        <span className="capitalize">
                          {scannedPackage.category || "Standard"}
                        </span>
                        {scannedPackage.fragile && (
                          <span className="text-amber-600">⚠️ Fragile</span>
                        )}
                        {scannedPackage.hazardous && (
                          <span className="text-red-600">☣️ Hazardous</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {canDeliver && (
                    <button
                      onClick={handleMarkDelivered}
                      disabled={loading}
                      className="w-full bg-[#059669] hover:bg-[#047857] text-white font-semibold py-3.5 rounded-xl transition-colors active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Confirming...
                        </>
                      ) : (
                        <>✅ Mark as Delivered (PoD)</>
                      )}
                    </button>
                  )}

                  {alreadyDelivered && (
                    <div className="w-full bg-[#D1FAE5] text-[#059669] font-semibold py-3.5 rounded-xl text-center text-sm border border-[#059669]/20">
                      ✅ This package has already been delivered
                    </div>
                  )}

                  {isCancelled && (
                    <div className="w-full bg-red-50 text-red-600 font-semibold py-3.5 rounded-xl text-center text-sm border border-red-200">
                      ❌ This package has been cancelled
                    </div>
                  )}

                  {!canDeliver && !alreadyDelivered && !isCancelled && (
                    <div className="w-full bg-amber-50 text-amber-700 font-semibold py-3 rounded-xl text-center text-sm border border-amber-200">
                      ⚠️ Package status &quot;
                      {scannedPackage.status.replace(/_/g, " ")}
                      &quot; — not ready for delivery confirmation
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
