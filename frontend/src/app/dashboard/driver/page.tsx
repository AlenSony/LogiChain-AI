import React from 'react';
import { createClient } from '@/lib/supabase/server';
import DriverTaskCard from '@/components/ui/DriverTaskCard';

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
  // Find package IDs that have tracking events assigned to this driver
  const { data: driverEvents } = await supabase
    .from('tracking_events')
    .select('package_id')
    .eq('employee_id', employee?.employee_id);
    
  const packageIds = Array.from(new Set((driverEvents || []).map(e => e.package_id)));

  let activeTasks = [];
  if (packageIds.length > 0) {
    const { data: packagesData } = await supabase
      .from('packages')
      .select('*')
      .in('package_id', packageIds)
      .neq('status', 'delivered')
      .neq('status', 'cancelled');
    
    activeTasks = packagesData || [];
  }

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
            <p className="font-semibold text-sm">{activeTasks.length} Pending</p>
          </div>
        </div>
      </div>

      {/* Task Manifest */}
      <div className="px-5 mt-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Task Manifest</h2>
        
        {activeTasks.map((task) => (
          <DriverTaskCard key={task.package_id} task={task} driverType={employee?.emp_type} />
        ))}

        {activeTasks.length === 0 && (
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
