import React from 'react';
import { createClient } from '@/lib/supabase/server';

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Fetch some metrics for the dashboard
  const { count: warehouseCount } = await supabase
    .from('warehouses')
    .select('*', { count: 'exact', head: true });

  const { count: activePackages } = await supabase
    .from('packages')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'delivered');

  const { data: criticalHubs } = await supabase
    .from('warehouses')
    .select('name, capacity, current_load')
    .gt('current_load', 45000); // threshold for bottlenecks

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Control Tower Terminal</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time macro logistics overview & agent telemetry.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#059669] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#059669]"></span>
          </span>
          <span className="text-sm font-medium text-[#059669]">System Optimal</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm hover:border-[#059669]/50 transition-colors">
          <p className="text-sm font-medium text-slate-500 mb-1">Active Fleet Pipelines</p>
          <p className="text-3xl font-bold text-slate-900">{activePackages || 0}</p>
          <div className="mt-4 text-xs font-medium text-[#059669] bg-[#D1FAE5] px-2 py-1 rounded w-max border border-[#059669]/20">
            +12% vs last hour
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm hover:border-[#059669]/50 transition-colors">
          <p className="text-sm font-medium text-slate-500 mb-1">Critical Bottlenecks</p>
          <p className="text-3xl font-bold text-slate-900">{criticalHubs?.length || 0}</p>
          <div className="mt-4 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded w-max border border-amber-200">
            {criticalHubs?.length ? `${criticalHubs[0].name} nearing capacity` : 'No active alerts'}
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm hover:border-[#059669]/50 transition-colors">
          <p className="text-sm font-medium text-slate-500 mb-1">Active Nodes</p>
          <p className="text-3xl font-bold text-slate-900">{warehouseCount || 0}</p>
          <div className="mt-4 text-xs font-medium text-[#059669] bg-[#D1FAE5] px-2 py-1 rounded w-max border border-[#059669]/20">
            100% Uptime
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm hover:border-[#059669]/50 transition-colors">
          <p className="text-sm font-medium text-slate-500 mb-1">Agent Load Balance</p>
          <p className="text-3xl font-bold text-slate-900">42ms</p>
          <div className="mt-4 text-xs font-medium text-[#059669] bg-[#D1FAE5] px-2 py-1 rounded w-max border border-[#059669]/20">
            Avg Routing Latency
          </div>
        </div>
      </div>

      {/* Swarm Intelligence Stream */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-slate-50/50">
          <h2 className="font-semibold text-slate-800">Swarm Intelligence Stream</h2>
          <button className="text-xs font-medium text-[#059669] hover:underline">View All Logs</button>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="w-2 h-2 rounded-full bg-[#059669] mt-1.5 shadow-[0_0_8px_rgba(5,150,105,0.6)]"></div>
              <div>
                <p className="text-sm font-medium text-slate-800">Warehouse optimization agent triggered</p>
                <p className="text-sm text-slate-500 mt-1">97% load detected at <span className="font-semibold">Hub Mumbai</span>. Rerouting flow 41B via <span className="font-semibold">Hub Bangalore</span>.</p>
                <p className="text-xs text-slate-400 mt-1">Just now</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-2 h-2 rounded-full bg-slate-300 mt-1.5"></div>
              <div>
                <p className="text-sm font-medium text-slate-800">Route re-calculation complete</p>
                <p className="text-sm text-slate-500 mt-1">Package TRK-98213456 path optimized for weather delay.</p>
                <p className="text-xs text-slate-400 mt-1">2 mins ago</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-2 h-2 rounded-full bg-slate-300 mt-1.5"></div>
              <div>
                <p className="text-sm font-medium text-slate-800">Fleet allocation agent</p>
                <p className="text-sm text-slate-500 mt-1">Assigned 3 idle pickup vehicles to high-density zones in Delhi South.</p>
                <p className="text-xs text-slate-400 mt-1">15 mins ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
