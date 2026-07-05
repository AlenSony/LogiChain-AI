-- ==========================================
-- ENABLE RLS & GRANTS
-- ==========================================

-- Grant basic schema usage and table access to authenticated and anon users
-- (Required because newer Supabase instances default to not auto-exposing tables)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Enable Row Level Security (RLS) on tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_location ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- POLICIES FOR 'profiles'
-- ==========================================
-- Users can read their own profile
CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- ==========================================
-- POLICIES FOR 'packages'
-- ==========================================
-- Customers can view their own packages
CREATE POLICY "Users can view own packages" 
    ON public.packages FOR SELECT 
    USING (auth.uid() = user_id);

-- Customers can insert their own packages
CREATE POLICY "Users can insert own packages" 
    ON public.packages FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Customers can update their own packages (optional, if needed)
CREATE POLICY "Users can update own packages" 
    ON public.packages FOR UPDATE 
    USING (auth.uid() = user_id);

-- ==========================================
-- POLICIES FOR 'warehouses'
-- ==========================================
-- Anyone authenticated can view warehouses
CREATE POLICY "Authenticated users can view warehouses"
    ON public.warehouses FOR SELECT
    TO authenticated
    USING (true);

-- (More policies for employees, tracking, etc. can be added later in Phase 3/4)
