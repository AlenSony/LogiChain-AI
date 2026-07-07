-- ==========================================
-- RLS POLICIES FOR 'employees'
-- ==========================================
CREATE POLICY "Employees can view own employee record"
ON public.employees FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all employees"
ON public.employees FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ==========================================
-- RLS POLICIES FOR 'tracking_events'
-- ==========================================
CREATE POLICY "Customers can view events for their packages"
ON public.tracking_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.packages
    WHERE packages.package_id = tracking_events.package_id
    AND packages.user_id = auth.uid()
  )
);

CREATE POLICY "Warehouse managers can view events for their warehouse"
ON public.tracking_events FOR SELECT
USING (
  warehouse_id = (SELECT warehouse_id FROM public.employees WHERE user_id = auth.uid())
);

CREATE POLICY "Drivers can view events for packages assigned to them"
ON public.tracking_events FOR SELECT
USING (
  employee_id = (SELECT employee_id FROM public.employees WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can view all tracking events"
ON public.tracking_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ==========================================
-- RLS POLICIES FOR 'warehouses'
-- ==========================================
CREATE POLICY "Managers can update their assigned warehouse"
ON public.warehouses FOR UPDATE
USING (
  warehouse_id = (SELECT warehouse_id FROM public.employees WHERE user_id = auth.uid())
);

-- ==========================================
-- RLS POLICIES FOR 'packages'
-- ==========================================
CREATE POLICY "Managers can view packages routed through their warehouse"
ON public.packages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.package_routes 
    WHERE package_routes.package_id = packages.package_id
    AND package_routes.warehouse_id = (SELECT warehouse_id FROM public.employees WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Managers can update packages routed through their warehouse"
ON public.packages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.package_routes 
    WHERE package_routes.package_id = packages.package_id
    AND package_routes.warehouse_id = (SELECT warehouse_id FROM public.employees WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Drivers can view packages assigned to them via tracking events"
ON public.packages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tracking_events
    WHERE tracking_events.package_id = packages.package_id
    AND tracking_events.employee_id = (SELECT employee_id FROM public.employees WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Drivers can update packages assigned to them via tracking events"
ON public.packages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.tracking_events
    WHERE tracking_events.package_id = packages.package_id
    AND tracking_events.employee_id = (SELECT employee_id FROM public.employees WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Admins can view all packages"
ON public.packages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update all packages"
ON public.packages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
);
