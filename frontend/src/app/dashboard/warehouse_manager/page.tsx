import React from 'react';
import { createClient } from '@/lib/supabase/server';
import WarehousePackageAction from '@/components/ui/WarehousePackageAction';

export default async function WarehouseManagerDashboard() {
  const supabase = await createClient();

  // 1. Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Fetch the manager's assigned warehouse
  const { data: employee } = await supabase
    .from('employees')
    .select('warehouse_id, warehouses(*)')
    .eq('user_id', user?.id)
    .single();

  const warehouseData = employee?.warehouses as any;
  const warehouse = Array.isArray(warehouseData) ? warehouseData[0] : warehouseData;

  // 3. Fetch packages currently in this warehouse
  let packages: any[] = [];
  if (warehouse) {
    const { data: nodePackages } = await supabase
      .from('packages')
      .select('*')
      .eq('status', 'in_warehouse');
    
    // For packages at this warehouse, verify via routing that they belong here
    const { data: routeLinks } = await supabase
      .from('package_routes')
      .select('package_id')
      .eq('warehouse_id', warehouse.warehouse_id);
    
    const validPackageIds = new Set((routeLinks || []).map(r => r.package_id));
    packages = (nodePackages || []).filter(pkg => validPackageIds.has(pkg.package_id));
  }

  const capacityPercent = warehouse 
    ? Math.round((warehouse.current_load / warehouse.capacity) * 100) 
    : 0;

  const isAlert = capacityPercent >= 90;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Node Hub Director</h1>
          <p className="text-slate-500 text-sm mt-1">
            {warehouse ? `Managing ${warehouse.name} (${warehouse.city})` : 'No node assigned'}
          </p>
        </div>
      </div>

      {/* Capacity Visualizer */}
      {warehouse && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Node Capacity Overview</h2>
              <p className="text-sm text-slate-500 mt-1">Current load vs maximum threshold</p>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold ${isAlert ? 'text-amber-600' : 'text-[#059669]'}`}>
                {capacityPercent}%
              </span>
              <p className="text-sm text-slate-500">Filled</p>
            </div>
          </div>
          
          <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div 
              className={`h-full transition-all duration-500 ${isAlert ? 'bg-amber-500' : 'bg-[#059669]'}`}
              style={{ width: `${capacityPercent}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between items-center mt-3 text-sm">
            <span className="font-medium text-slate-700">{warehouse.current_load.toLocaleString()} units</span>
            <span className="text-slate-500">Max {warehouse.capacity.toLocaleString()} units</span>
          </div>

          {isAlert && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <span className="text-amber-600 font-bold">!</span>
              <div>
                <p className="text-sm font-medium text-amber-800">Capacity Warning: Exceeds 90% Threshold</p>
                <p className="text-xs text-amber-600 mt-1">Swarm routing agent is automatically diverting incoming non-critical freight to secondary nodes.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Node Operations Grid */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] bg-slate-50/50">
          <h2 className="font-semibold text-slate-800">Node Operations Grid</h2>
          <p className="text-xs text-slate-500 mt-1">Packages currently resting in this node</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-xs uppercase text-slate-500 bg-white">
                <th className="px-6 py-3 font-medium">Tracking ID</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Weight</th>
                <th className="px-6 py-3 font-medium">Destination</th>
                <th className="px-6 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {packages.map((pkg) => (
                <tr key={pkg.package_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{pkg.tracking_number}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 capitalize">
                    {pkg.category || 'Standard'}
                    {pkg.fragile && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Fragile</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{pkg.weight} kg</td>
                  <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[200px]">{pkg.destination_address}</td>
                  <td className="px-6 py-4">
                    <WarehousePackageAction packageId={pkg.package_id} />
                  </td>
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No packages currently active in this node.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
