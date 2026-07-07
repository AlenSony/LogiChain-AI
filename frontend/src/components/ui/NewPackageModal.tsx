"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewPackageModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [destinationAddress, setDestinationAddress] = useState("");
  const [sourceAddress, setSourceAddress] = useState("");
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [category, setCategory] = useState("General Freight");
  const [fragile, setFragile] = useState(false);
  const [hazardous, setHazardous] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Unauthenticated user session.");

      // Generate deterministic alphanumeric tracking string
      const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
      const trackingNumber = `LC-AI-${randomString}`;

      const payload = {
        user_id: user.id,
        tracking_number: trackingNumber,
        destination_address: destinationAddress,
        source_address: sourceAddress,
        weight: parseFloat(weight) || 0,
        length: parseFloat(length) || 0,
        width: parseFloat(width) || 0,
        height: parseFloat(height) || 0,
        category,
        fragile,
        hazardous,
        status: "pending",
      };

      const { error } = await supabase.from("packages").insert(payload);

      if (error) throw error;

      // Reset form & close modal
      setDestinationAddress("");
      setSourceAddress("");
      setWeight("");
      setLength("");
      setWidth("");
      setHeight("");
      setCategory("General Freight");
      setFragile(false);
      setHazardous(false);
      setIsOpen(false);

      // Trigger verification feedback loop
      setToastMessage(`Success! Shipment ${trackingNumber} logged into the network.`);
      router.refresh();

      // Clear toast after 5 seconds
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      alert(`Error provisioning shipment: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-primary"
        style={{ width: "auto" }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginRight: 8 }}
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        + Book New Shipment
      </button>

      {/* Temporary Toast Notification */}
      {toastMessage && (
        <div
          className="animate-fade-in"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "var(--jade-50)",
            border: "1px solid var(--jade-100)",
            color: "var(--jade-700)",
            padding: "16px 24px",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-card-hover)",
            fontWeight: 500,
            zIndex: 9999,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Modal Dialog Overlay */}
      {isOpen && (
        <div
          className="animate-fade-in"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 24,
          }}
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Content */}
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 640,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "32px 40px",
            }}
            onClick={(e) => e.stopPropagation()} // Prevent clicking inside modal from closing it
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "var(--foreground)",
                  letterSpacing: "-0.01em",
                }}
              >
                Provision Shipment
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--foreground-secondary)",
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: 20 }}>
                {/* Source & Destination */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label className="input-label">Source Node Address</label>
                    <textarea
                      required
                      rows={3}
                      value={sourceAddress}
                      onChange={(e) => setSourceAddress(e.target.value)}
                      className="input-field"
                      style={{ resize: "none" }}
                      placeholder="Origin facility..."
                    />
                  </div>
                  <div>
                    <label className="input-label">Destination Node Address</label>
                    <textarea
                      required
                      rows={3}
                      value={destinationAddress}
                      onChange={(e) => setDestinationAddress(e.target.value)}
                      className="input-field"
                      style={{ resize: "none" }}
                      placeholder="Target delivery coordinate..."
                    />
                  </div>
                </div>

                {/* Vectors */}
                <div>
                  <label className="input-label">Physical Vector Metrics (kg / cm)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      required
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="input-field"
                      placeholder="Weight"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      required
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      className="input-field"
                      placeholder="Length"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      required
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      className="input-field"
                      placeholder="Width"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      required
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="input-field"
                      placeholder="Height"
                    />
                  </div>
                </div>

                {/* Category & Safety */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label className="input-label">Cargo Classification</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="input-field"
                      style={{ appearance: "none" }}
                    >
                      <option>General Freight</option>
                      <option>Electronics</option>
                      <option>Perishables</option>
                      <option>Documents</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Safety Parameters</label>
                    <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={fragile}
                          onChange={(e) => setFragile(e.target.checked)}
                          style={{ accentColor: "var(--jade-600)" }}
                        />
                        Fragile Cargo Vector
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={hazardous}
                          onChange={(e) => setHazardous(e.target.checked)}
                          style={{ accentColor: "var(--jade-600)" }}
                        />
                        Hazardous Label
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: "var(--background-subtle)",
                    border: "1px solid var(--border)",
                    padding: "10px 20px",
                    borderRadius: "var(--radius-sm)",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: "auto" }}
                  disabled={loading}
                >
                  {loading ? "Transmitting..." : "Initialize Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
