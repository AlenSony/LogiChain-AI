"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function WarehousePackageAction({ packageId }: { packageId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAdvanceStatus() {
    if (!confirm("Are you sure you want to scan this package out of the warehouse and mark it as In Transit?")) return;
    
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("packages")
        .update({ status: "in_transit" })
        .eq("package_id", packageId);

      if (error) throw error;
      
      router.refresh();
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button 
      onClick={handleAdvanceStatus}
      disabled={loading}
      className="text-xs font-medium text-[#059669] hover:text-[#047857] bg-[#D1FAE5] px-3 py-1 rounded-full border border-[#059669]/20 transition-colors disabled:opacity-50"
    >
      {loading ? "Scanning..." : "Scan Next Route"}
    </button>
  );
}
