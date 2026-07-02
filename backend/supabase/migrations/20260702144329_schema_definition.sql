-- ==========================================
-- 1. EXTENSIONS & ENUMS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM (
    'customer', 
    'admin', 
    'warehouse_manager', 
    'pickup_employee', 
    'delivery_employee'
);

CREATE TYPE employee_type AS ENUM (
    'pickup_agent', 
    'warehouse_operator', 
    'delivery_agent', 
    'route_manager'
);

CREATE TYPE package_status AS ENUM (
    'pending', 
    'pickup_scheduled', 
    'picked_up', 
    'in_warehouse', 
    'in_transit', 
    'out_for_delivery', 
    'delivered', 
    'cancelled'
);

-- ==========================================
-- 2. CORE INFRASTRUCTURE TABLES
-- ==========================================

-- Public profiles extending Supabase Auth Users
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    role user_role NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Warehouses (Physical Graph Nodes)
CREATE TABLE public.warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    capacity INT NOT NULL,
    current_load INT DEFAULT 0 CHECK (current_load >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Employees (Fleet details tied to profiles)
CREATE TABLE public.employees (
    employee_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    emp_type employee_type NOT NULL,
    warehouse_id INT REFERENCES public.warehouses(warehouse_id) ON DELETE SET NULL,
    vehicle_id VARCHAR(100), -- Can tie to a fleet asset management table later
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    joined_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- ==========================================
-- 3. PACKAGES & ROUTING LEDGER
-- ==========================================

-- Core Packages table
CREATE TABLE public.packages (
    package_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Customer who ordered
    tracking_number VARCHAR(100) UNIQUE NOT NULL,
    weight DECIMAL(10,2),
    length DECIMAL(10,2),
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    category VARCHAR(100),
    fragile BOOLEAN DEFAULT FALSE,
    hazardous BOOLEAN DEFAULT FALSE,
    status package_status NOT NULL DEFAULT 'pending',
    source_address TEXT NOT NULL,
    destination_address TEXT NOT NULL,
    pickup_date TIMESTAMP WITH TIME ZONE,
    delivery_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Package Routes (The multi-hub sequence calculated by AI)
CREATE TABLE public.package_routes (
    id SERIAL PRIMARY KEY,
    package_id INT REFERENCES public.packages(package_id) ON DELETE CASCADE,
    warehouse_id INT REFERENCES public.warehouses(warehouse_id) ON DELETE CASCADE,
    sequence_no INT NOT NULL,
    arrival_time TIMESTAMP WITH TIME ZONE,
    departure_time TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_package_sequence UNIQUE (package_id, sequence_no)
);

-- ==========================================
-- 4. OPERATIONS & TELEMETRY
-- ==========================================

-- Audit trail / Custody transfers
CREATE TABLE public.tracking_events (
    event_id SERIAL PRIMARY KEY,
    package_id INT REFERENCES public.packages(package_id) ON DELETE CASCADE,
    warehouse_id INT REFERENCES public.warehouses(warehouse_id) ON DELETE SET NULL,
    employee_id INT REFERENCES public.employees(employee_id) ON DELETE SET NULL,
    status package_status NOT NULL,
    remarks TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Real-time high-frequency GPS logs
CREATE TABLE public.package_location (
    package_id INT REFERENCES public.packages(package_id) ON DELETE CASCADE,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (package_id, timestamp)
);

-- ==========================================
-- 5. SUPABASE AUTH TRIGGERS & PERMISSIONS
-- ==========================================

-- Automatically create a profile when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', 'New User'),
        new.email,
        COALESCE((new.raw_user_meta_data->>'role')::user_role, 'customer'::user_role)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Realtime for live tracking updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.package_location;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouses;

-- Performance Optimizations (Indexes)
CREATE INDEX idx_packages_tracking ON public.packages(tracking_number);
CREATE INDEX idx_routes_package ON public.package_routes(package_id);
CREATE INDEX idx_events_package ON public.tracking_events(package_id);