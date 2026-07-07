import React from 'react';
import { createClient } from '@/lib/supabase/server';

export default async function DriverDashboard() {
  const supabase = await createClient();

  // 1. Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Fetch the driver's profile & employee record
  const { data: employee } = await supabase
    .from('employees')
    .select('emp_type, vehicle_id, profiles(name)')
    .eq('user_id', user?.id)
    .single();

  const profilesData = employee?.profiles as any;
  const profile = Array.isArray(profilesData) ? profilesData[0] : profilesData;
  const driverName = profile?.name || 'Driver';
  const isDelivery = employee?.emp_type === 'delivery_agent';

  // 3. Fetch active tasks for this driver
  // In a real app, this would query a dispatch or assignment table.
  // We'll mock a few tasks for the UI presentation.
  const mockTasks = [
    {
      id: 'TRK-98213460',
      type: isDelivery ? 'delivery' : 'pickup',
      address: isDelivery ? 'Powai, Mumbai' : 'Chembur, Mumbai',
      status: 'pending',
      details: 'Medical Supplies - Fragile',
      time: '10:30 AM',
    },
    {
      id: 'TRK-98213462',
      type: isDelivery ? 'delivery' : 'pickup',
      address: 'Juhu, Mumbai',
      status: 'pending',
      details: 'Standard Package',
      time: '11:45 AM',
    },
  ];

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#F8FAFC] pb-24 sm:pb-8">
      {/* Mobile Header */}
      <div className="bg-[#059669] text-white px-5 py-6 rounded-b-3xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-emerald-100 text-sm font-medium">Good Morning,</p>
            <h1 className="text-2xl font-bold">{driverName}</h1>
          </div>
          <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center border border-white/30 backdrop-blur-sm">
            <span className="text-white font-bold text-lg">{driverName.charAt(0)}</span>
          </div>
        </div>
        <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/20">
          <div>
            <p className="text-emerald-100 text-xs">Active Vehicle</p>
            <p className="font-semibold text-sm">{employee?.vehicle_id || 'Unassigned'}</p>
          </div>
          <div className="h-8 w-px bg-white/20"></div>
          <div>
            <p className="text-emerald-100 text-xs">Today's Tasks</p>
            <p className="font-semibold text-sm">{mockTasks.length} Pending</p>
          </div>
        </div>
      </div>

      {/* Task Manifest */}
      <div className="px-5 mt-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Task Manifest</h2>
        
        {mockTasks.map((task, idx) => (
          <div key={task.id} className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm relative overflow-hidden">
            {/* Edge-to-edge accent indicator */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#059669]"></div>
            
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded">
                  {task.time}
                </span>
                <h3 className="font-bold text-slate-900 text-lg mt-1">{task.id}</h3>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${
                task.type === 'delivery' 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                {task.type}
              </span>
            </div>
            
            <p className="text-slate-600 text-sm font-medium mb-1 line-clamp-1">{task.address}</p>
            <p className="text-slate-400 text-xs mb-4">{task.details}</p>
            
            <button className="w-full bg-[#059669] hover:bg-[#047857] text-white font-semibold py-3.5 rounded-xl transition-colors active:scale-[0.98] shadow-sm flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Start {task.type === 'delivery' ? 'Delivery' : 'Pickup'}
            </button>
          </div>
        ))}

        {mockTasks.length === 0 && (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">All tasks completed for today.</p>
          </div>
        )}
      </div>

      {/* Handshake Handlers (Placeholders) */}
      <div className="px-5 mt-8 space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Verification Tools</h2>
        <div className="grid grid-cols-2 gap-4">
          <button className="bg-white border border-[#E2E8F0] p-4 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-[#059669] transition-colors shadow-sm group">
            <div className="w-12 h-12 rounded-full bg-[#D1FAE5] text-[#059669] flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-700">QR Scanner</span>
          </button>
          
          <button className="bg-white border border-[#E2E8F0] p-4 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-[#059669] transition-colors shadow-sm group">
            <div className="w-12 h-12 rounded-full bg-[#D1FAE5] text-[#059669] flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-700">PoD Upload</span>
          </button>
        </div>
      </div>
    </div>
  );
}
