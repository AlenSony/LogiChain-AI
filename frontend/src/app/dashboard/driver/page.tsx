import React from 'react';
import { createClient } from '@/lib/supabase/server';
import DriverTaskCard from '@/components/ui/DriverTaskCard';
import QRScannerModal from '@/components/ui/QRScannerModal';
import TrackingMapWrapper from '@/components/ui/TrackingMapWrapper';
import TrackingTimeline from '@/components/ui/TrackingTimeline';
import type { TrackingEvent, Warehouse, Package } from '@/types/logistics';

export default async function DriverDashboard() {
  const supabase = await createClient();

  // 1. Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Fetch the driver's profile & employee record
  const { data: employee } = await supabase
    .from('employees')
    .select('employee_id, emp_type, vehicle_id, warehouse_id, profiles(name)')
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

  let activeTasks: Package[] = [];
  if (packageIds.length > 0) {
    const { data: packagesData } = await supabase
      .from('packages')
      .select('*')
      .in('package_id', packageIds)
      .neq('status', 'delivered')
      .neq('status', 'cancelled');
    
    activeTasks = (packagesData || []) as Package[];
  }

  // 4. Fetch tracking events for active tasks (for timeline)
  const taskTrackingEvents: Record<number, TrackingEvent[]> = {};
  if (activeTasks.length > 0) {
    const activeIds = activeTasks.map(t => t.package_id);
    const { data: events } = await supabase
      .from('tracking_events')
      .select('*')
      .in('package_id', activeIds)
      .order('timestamp', { ascending: true });
    
    for (const event of (events || []) as TrackingEvent[]) {
      if (event.package_id !== null) {
        if (!taskTrackingEvents[event.package_id]) {
          taskTrackingEvents[event.package_id] = [];
        }
        taskTrackingEvents[event.package_id].push(event);
      }
    }
  }

  // 5. Fetch warehouse hubs for the map context
  const { data: warehouseData } = await supabase
    .from('warehouses')
    .select('*');
  
  const warehouses = (warehouseData || []) as Warehouse[];

  // 6. Find the primary active delivery task for the map
  const primaryTask = activeTasks.find(t => 
    ['out_for_delivery', 'in_transit'].includes(t.status)
  ) || activeTasks[0];

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
            <p className="text-emerald-100 text-xs">Today&apos;s Tasks</p>
            <p className="font-semibold text-sm">{activeTasks.length} Pending</p>
          </div>
        </div>
      </div>

      {/* Live GPS Map — shows primary active task */}
      {primaryTask && (
        <div className="px-5 mt-6">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Live Tracking</h2>
          <TrackingMapWrapper
            packageId={primaryTask.package_id}
            trackingNumber={primaryTask.tracking_number}
            warehouses={warehouses}
            height={280}
          />
        </div>
      )}

      {/* Task Manifest */}
      <div className="px-5 mt-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Task Manifest</h2>
        
        {activeTasks.map((task) => (
          <div key={task.package_id} className="space-y-3">
            <DriverTaskCard task={task} driverType={employee?.emp_type} />
            
            {/* Per-task Tracking Timeline */}
            {taskTrackingEvents[task.package_id]?.length > 0 && (
              <details className="group">
                <summary className="text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-[#059669] transition-colors flex items-center gap-1.5 pl-1">
                  <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                  Tracking History ({taskTrackingEvents[task.package_id].length} events)
                </summary>
                <div className="mt-3 ml-1">
                  <TrackingTimeline
                    events={taskTrackingEvents[task.package_id]}
                    currentStatus={task.status}
                  />
                </div>
              </details>
            )}
          </div>
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

      {/* Verification Tools */}
      <div className="px-5 mt-8 space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Verification Tools</h2>
        <div className="grid grid-cols-2 gap-4">
          {/* QR Scanner — functional component replaces the placeholder */}
          <QRScannerModal 
            employeeId={employee?.employee_id ?? 0} 
            warehouseId={employee?.warehouse_id}
          />
          
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
