import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewPackageModal from "@/components/ui/NewPackageModal";

export const metadata = {
  title: "Customer Dashboard | LogiChain AI",
};

export default async function CustomerDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch package manifest for current user
  const { data: packages, error } = await supabase
    .from("packages")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching packages:", error.message);
  }

  const manifest = packages || [];

  // Calculate Summary Metrics
  const activeShipments = manifest.filter((p) =>
    ["pending", "pickup_scheduled", "in_transit", "out_for_delivery"].includes(p.status)
  ).length;

  const inWarehouse = manifest.filter((p) =>
    ["picked_up", "in_warehouse"].includes(p.status)
  ).length;

  const delivered = manifest.filter((p) => p.status === "delivered").length;

  // Helper for Status Badge Rendering
  function renderStatusBadge(status: string) {
    let bg = "var(--background-muted)";
    let color = "var(--foreground-secondary)";
    let label = status.replace(/_/g, " ").toUpperCase();

    if (["delivered", "in_transit"].includes(status)) {
      bg = "var(--jade-50)";
      color = "var(--jade-700)";
    } else if (["out_for_delivery"].includes(status)) {
      bg = "#FEF3C7"; // Soft amber
      color = "#B45309";
    }

    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 10px",
          background: bg,
          color: color,
          borderRadius: 100,
          fontSize: "0.6875rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--background-subtle)",
        padding: "40px 24px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        
        {/* ── Header ────────────────────────────────────────── */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "var(--foreground)",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              LogiChain Customer Console
            </h1>
            <p style={{ color: "var(--foreground-secondary)", fontSize: "0.875rem", marginTop: 4 }}>
              Autonomous Route & Vector Management
            </p>
          </div>

          <div
            className="card"
            style={{
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderRadius: 100,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--jade-100)",
                color: "var(--jade-700)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.875rem",
              }}
            >
              {(user.user_metadata?.name || "U")[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                {user.user_metadata?.name || "Verified User"}
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--foreground-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {user.user_metadata?.role || "Customer"}
              </div>
            </div>
          </div>
        </header>

        {/* ── Summary Stats ─────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            marginBottom: 40,
          }}
        >
          {[
            { label: "Active Shipments", value: activeShipments },
            { label: "In Warehouse Node", value: inWarehouse },
            { label: "Delivered Vectors", value: delivered },
          ].map((stat, i) => (
            <div
              key={i}
              className="card"
              style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8 }}
            >
              <span className="input-label" style={{ margin: 0 }}>
                {stat.label}
              </span>
              <span
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--foreground)",
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── Manifest Header ───────────────────────────────── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              color: "var(--foreground)",
              margin: 0,
            }}
          >
            Package Manifest
          </h2>
          <NewPackageModal />
        </div>

        {/* ── Data Grid ─────────────────────────────────────── */}
        <div className="card" style={{ overflow: "hidden" }}>
          {manifest.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <p style={{ color: "var(--foreground-secondary)", fontSize: "0.875rem" }}>
                No tracking data found in current session context.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: "var(--background-subtle)",
                    }}
                  >
                    <th style={{ padding: "16px 24px", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)" }}>
                      TRACKING ID
                    </th>
                    <th style={{ padding: "16px 24px", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)" }}>
                      DESTINATION VECTOR
                    </th>
                    <th style={{ padding: "16px 24px", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)" }}>
                      OPERATIONAL STATUS
                    </th>
                    <th style={{ padding: "16px 24px", fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-secondary)" }}>
                      DATE LOGGED
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {manifest.map((pkg) => (
                    <tr
                      key={pkg.package_id}
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td style={{ padding: "16px 24px", fontWeight: 600, fontSize: "0.875rem" }}>
                        {pkg.tracking_number}
                      </td>
                      <td style={{ padding: "16px 24px", fontSize: "0.875rem", color: "var(--foreground-secondary)", maxWidth: 300, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {pkg.destination_address}
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        {renderStatusBadge(pkg.status)}
                      </td>
                      <td style={{ padding: "16px 24px", fontSize: "0.875rem", color: "var(--foreground-secondary)" }}>
                        {new Date(pkg.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
