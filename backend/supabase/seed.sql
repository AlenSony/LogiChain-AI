-- LogiChain AI Phase 3 - Data Mock Seed
-- Populates entities for Role-Specific Routing Gateways

-- 1. Mock Users in auth.users
-- This will automatically trigger `handle_new_user()` to populate `public.profiles`.
-- IMPORTANT: GoTrue requires all token/string columns to be empty strings (''), NOT NULL.
-- Omitting them causes a 500 "converting NULL to string is unsupported" on login.
-- Exception: `phone` must be NULL (not '') for users without phone numbers due to UNIQUE constraint.
INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud,
    confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change,
    phone, phone_change, phone_change_token,
    reauthentication_token, is_sso_user, is_anonymous
) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'admin@logichain.ai', extensions.crypt('password123', extensions.gen_salt('bf')), NOW(), '{"provider": "email", "providers": ["email"]}', '{"name": "System Admin", "role": "admin"}', NOW(), NOW(), 'authenticated', 'authenticated', '', '', '', '', '', NULL, '', '', '', false, false),
('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'manager@logichain.ai', extensions.crypt('password123', extensions.gen_salt('bf')), NOW(), '{"provider": "email", "providers": ["email"]}', '{"name": "Node Hub Director", "role": "warehouse_manager"}', NOW(), NOW(), 'authenticated', 'authenticated', '', '', '', '', '', NULL, '', '', '', false, false),
('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'pickup@logichain.ai', extensions.crypt('password123', extensions.gen_salt('bf')), NOW(), '{"provider": "email", "providers": ["email"]}', '{"name": "Pickup Driver Agent", "role": "pickup_employee"}', NOW(), NOW(), 'authenticated', 'authenticated', '', '', '', '', '', NULL, '', '', '', false, false),
('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'delivery@logichain.ai', extensions.crypt('password123', extensions.gen_salt('bf')), NOW(), '{"provider": "email", "providers": ["email"]}', '{"name": "Delivery Driver Agent", "role": "delivery_employee"}', NOW(), NOW(), 'authenticated', 'authenticated', '', '', '', '', '', NULL, '', '', '', false, false),
('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'customer@enterprise.com', extensions.crypt('password123', extensions.gen_salt('bf')), NOW(), '{"provider": "email", "providers": ["email"]}', '{"name": "Enterprise Client", "role": "customer"}', NOW(), NOW(), 'authenticated', 'authenticated', '', '', '', '', '', NULL, '', '', '', false, false)
ON CONFLICT (id) DO NOTHING;

-- Insert Identities to prevent GoTrue 500 errors on login
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', format('{"sub":"%s","email":"%s"}', '11111111-1111-1111-1111-111111111111', 'admin@logichain.ai')::jsonb, 'email', NOW(), NOW(), NOW()),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', format('{"sub":"%s","email":"%s"}', '22222222-2222-2222-2222-222222222222', 'manager@logichain.ai')::jsonb, 'email', NOW(), NOW(), NOW()),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', format('{"sub":"%s","email":"%s"}', '33333333-3333-3333-3333-333333333333', 'pickup@logichain.ai')::jsonb, 'email', NOW(), NOW(), NOW()),
(gen_random_uuid(), '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', format('{"sub":"%s","email":"%s"}', '44444444-4444-4444-4444-444444444444', 'delivery@logichain.ai')::jsonb, 'email', NOW(), NOW(), NOW()),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', format('{"sub":"%s","email":"%s"}', '55555555-5555-5555-5555-555555555555', 'customer@enterprise.com')::jsonb, 'email', NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 2. Mock Warehouses (Physical Graph Nodes)
INSERT INTO public.warehouses (warehouse_id, name, address, city, state, latitude, longitude, capacity, current_load) VALUES
(1, 'Hub Mumbai', 'Andheri East', 'Mumbai', 'Maharashtra', 19.1136, 72.8697, 50000, 48500), -- 97% load (Alert)
(2, 'Hub Bangalore', 'Whitefield', 'Bangalore', 'Karnataka', 12.9698, 77.7499, 50000, 32000), -- 64% load
(3, 'Hub Chennai', 'Guindy', 'Chennai', 'Tamil Nadu', 13.0067, 80.2206, 50000, 15000), -- 30% load
(4, 'Hub Delhi', 'Okhla', 'New Delhi', 'Delhi', 28.5273, 77.2783, 50000, 42000) -- 84% load
ON CONFLICT (warehouse_id) DO UPDATE SET 
current_load = EXCLUDED.current_load;

-- Reset sequence
SELECT setval('warehouses_warehouse_id_seq', (SELECT MAX(warehouse_id) FROM public.warehouses));

-- 3. Mock Employees
-- Mapping predefined users to employee table
INSERT INTO public.employees (employee_id, user_id, emp_type, warehouse_id, vehicle_id, status) VALUES
(1, '22222222-2222-2222-2222-222222222222', 'warehouse_operator', 1, NULL, 'active'),
(2, '33333333-3333-3333-3333-333333333333', 'pickup_agent', 1, 'MH-04-AB-1234', 'active'),
(3, '44444444-4444-4444-4444-444444444444', 'delivery_agent', 1, 'MH-02-CD-5678', 'active')
ON CONFLICT (employee_id) DO NOTHING;

SELECT setval('employees_employee_id_seq', (SELECT MAX(employee_id) FROM public.employees));

-- 4. Mock Packages
INSERT INTO public.packages (package_id, user_id, tracking_number, weight, length, width, height, category, fragile, hazardous, status, source_address, destination_address, pickup_date) VALUES
(1, '55555555-5555-5555-5555-555555555555', 'TRK-98213456', 2.5, 30, 20, 15, 'electronics', true, false, 'in_warehouse', 'Nariman Point, Mumbai', 'Indiranagar, Bangalore', NOW() - INTERVAL '1 day'),
(2, '55555555-5555-5555-5555-555555555555', 'TRK-98213457', 15.0, 50, 40, 30, 'industrial', false, false, 'in_transit', 'Bandra, Mumbai', 'T Nagar, Chennai', NOW() - INTERVAL '2 days'),
(3, '55555555-5555-5555-5555-555555555555', 'TRK-98213458', 1.0, 10, 10, 5, 'documents', false, false, 'pending', 'Vashi, Navi Mumbai', 'Connaught Place, Delhi', NULL),
(4, '55555555-5555-5555-5555-555555555555', 'TRK-98213459', 8.2, 40, 30, 20, 'apparel', false, false, 'in_warehouse', 'Thane, Mumbai', 'Koramangala, Bangalore', NOW() - INTERVAL '5 hours'),
(5, '55555555-5555-5555-5555-555555555555', 'TRK-98213460', 4.5, 25, 25, 25, 'medical', true, true, 'out_for_delivery', 'Andheri, Mumbai', 'Powai, Mumbai', NOW() - INTERVAL '6 hours'),
(6, '55555555-5555-5555-5555-555555555555', 'TRK-98213461', 22.0, 80, 60, 40, 'furniture', false, false, 'pending', 'Dadar, Mumbai', 'Vasant Kunj, Delhi', NULL),
(7, '55555555-5555-5555-5555-555555555555', 'TRK-98213462', 0.5, 15, 10, 5, 'jewelry', true, false, 'delivered', 'Malad, Mumbai', 'Juhu, Mumbai', NOW() - INTERVAL '3 days'),
(8, '55555555-5555-5555-5555-555555555555', 'TRK-98213463', 5.5, 30, 30, 30, 'electronics', true, false, 'in_transit', 'Borivali, Mumbai', 'HSR Layout, Bangalore', NOW() - INTERVAL '1 day'),
(9, '55555555-5555-5555-5555-555555555555', 'TRK-98213464', 12.0, 45, 35, 25, 'automotive', false, false, 'in_warehouse', 'Goregaon, Mumbai', 'Adyar, Chennai', NOW() - INTERVAL '2 hours'),
(10, '55555555-5555-5555-5555-555555555555', 'TRK-98213465', 3.0, 20, 20, 15, 'books', false, false, 'pickup_scheduled', 'Chembur, Mumbai', 'Dwarka, Delhi', NULL)
ON CONFLICT (package_id) DO NOTHING;

SELECT setval('packages_package_id_seq', (SELECT MAX(package_id) FROM public.packages));

-- 5. Mock Tracking Events
INSERT INTO public.tracking_events (package_id, warehouse_id, employee_id, status, remarks, timestamp) VALUES
(1, 1, 2, 'picked_up', 'Package picked up from source.', NOW() - INTERVAL '20 hours'),
(1, 1, 1, 'in_warehouse', 'Received at Hub Mumbai. Scanning for next route.', NOW() - INTERVAL '15 hours'),
(2, 1, 2, 'picked_up', 'Package picked up.', NOW() - INTERVAL '40 hours'),
(2, 1, 1, 'in_warehouse', 'Received at Hub Mumbai.', NOW() - INTERVAL '38 hours'),
(2, 1, NULL, 'in_transit', 'Dispatched from Hub Mumbai towards Hub Chennai.', NOW() - INTERVAL '24 hours'),
(4, 1, 2, 'picked_up', 'Picked up.', NOW() - INTERVAL '4 hours'),
(4, 1, 1, 'in_warehouse', 'Processing at Hub Mumbai.', NOW() - INTERVAL '1 hour'),
(5, 1, 3, 'out_for_delivery', 'Out for delivery to final destination.', NOW() - INTERVAL '1 hour'),
(8, 1, 2, 'picked_up', 'Picked up.', NOW() - INTERVAL '18 hours'),
(8, 1, NULL, 'in_transit', 'Dispatched to Bangalore.', NOW() - INTERVAL '10 hours'),
(9, 1, 1, 'in_warehouse', 'Received at Hub Mumbai.', NOW() - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;

-- 6. Mock Routes (Multi-Hub)
INSERT INTO public.package_routes (package_id, warehouse_id, sequence_no) VALUES
(1, 1, 1),
(1, 2, 2),
(2, 1, 1),
(2, 3, 2),
(4, 1, 1),
(4, 2, 2),
(8, 1, 1),
(8, 2, 2),
(9, 1, 1),
(9, 3, 2)
ON CONFLICT DO NOTHING;
