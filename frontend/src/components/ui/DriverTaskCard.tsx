"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DriverTaskCard({ 
  task, 
  driverType 
}: { 
  task: any, 
  driverType: string 
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPodUpload, setShowPodUpload] = useState(false);
  const [podPreview, setPodPreview] = useState<string | null>(null);

  const getNextStateInfo = () => {
    if (driverType === 'pickup_agent') {
      if (['pending', 'pickup_scheduled'].includes(task.status)) return { next: 'picked_up', label: 'Mark Picked Up' };
      if (task.status === 'picked_up') return { next: 'in_warehouse', label: 'Drop at Warehouse' };
    } else {
      if (['in_warehouse', 'in_transit'].includes(task.status)) return { next: 'out_for_delivery', label: 'Start Delivery' };
      if (task.status === 'out_for_delivery') return { next: 'delivered', label: 'Mark Delivered' };
    }
    return null;
  };

  const nextStateInfo = getNextStateInfo();

  async function handleAdvanceStatus(targetStatus: string) {
    if (targetStatus === 'delivered' && !podPreview) {
      alert("Proof of delivery photo is required!");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from("packages")
        .update({ status: targetStatus })
        .eq("package_id", task.package_id);

      if (error) throw error;
      
      setShowPodUpload(false);
      setPodPreview(null);
      router.refresh();
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const handleActionClick = () => {
    if (!nextStateInfo) return;

    if (nextStateInfo.next === 'delivered') {
      setShowPodUpload(true);
    } else {
      if (confirm(`Update package ${task.tracking_number} status to ${nextStateInfo.next.replace(/_/g, ' ').toUpperCase()}?`)) {
        handleAdvanceStatus(nextStateInfo.next);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPodPreview(url);
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm relative overflow-hidden">
      {/* Edge-to-edge accent indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#059669]"></div>
      
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded">
            {task.status.replace(/_/g, ' ')}
          </span>
          <h3 className="font-bold text-slate-900 text-lg mt-1">{task.tracking_number}</h3>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${
          driverType === 'delivery_agent' 
            ? 'bg-blue-50 text-blue-700 border-blue-200' 
            : 'bg-purple-50 text-purple-700 border-purple-200'
        }`}>
          {driverType === 'delivery_agent' ? 'delivery' : 'pickup'}
        </span>
      </div>
      
      <p className="text-slate-600 text-sm font-medium mb-1 line-clamp-1">
        {driverType === 'delivery_agent' ? task.destination_address : task.source_address}
      </p>
      <p className="text-slate-400 text-xs mb-4">
        {task.weight}kg • {task.category || 'Standard'} {task.fragile && '• Fragile'} {task.hazardous && '• Hazardous'}
      </p>
      
      {showPodUpload ? (
        <div className="mt-4 p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-center">
          <p className="text-sm font-semibold text-slate-700 mb-2">Upload Proof of Delivery</p>
          {podPreview ? (
            <div className="space-y-3">
              <img src={podPreview} alt="PoD Preview" className="h-32 object-cover rounded-lg mx-auto border border-slate-200" />
              <div className="flex gap-2">
                <button 
                  onClick={() => setPodPreview(null)}
                  className="flex-1 bg-white border border-slate-200 text-slate-600 font-semibold py-2 rounded-lg text-sm"
                >
                  Retake
                </button>
                <button 
                  onClick={() => handleAdvanceStatus('delivered')}
                  disabled={loading}
                  className="flex-1 bg-[#059669] hover:bg-[#047857] text-white font-semibold py-2 rounded-lg text-sm"
                >
                  {loading ? 'Submitting...' : 'Confirm Delivery'}
                </button>
              </div>
            </div>
          ) : (
            <label className="cursor-pointer block bg-white border border-slate-200 py-3 rounded-lg hover:bg-slate-100 transition-colors">
              <span className="text-sm text-slate-600 font-medium block">Tap to Capture Photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          )}
          <button 
            onClick={() => { setShowPodUpload(false); setPodPreview(null); }}
            className="text-xs text-slate-500 hover:text-slate-700 underline mt-3"
          >
            Cancel
          </button>
        </div>
      ) : (
        nextStateInfo ? (
          <button 
            onClick={handleActionClick}
            disabled={loading}
            className="w-full bg-[#059669] hover:bg-[#047857] text-white font-semibold py-3.5 rounded-xl transition-colors active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Processing..." : nextStateInfo.label}
          </button>
        ) : (
          <div className="w-full bg-slate-100 text-slate-500 font-semibold py-3.5 rounded-xl text-center text-sm border border-slate-200">
            No further actions available
          </div>
        )
      )}
    </div>
  );
}
