-- Fix: Use CASE instead of COALESCE with direct cast to safely handle
-- NULL or invalid role values from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', 'New User'),
        new.email,
        CASE
            WHEN new.raw_user_meta_data->>'role' IN (
                'customer', 'admin', 'warehouse_manager',
                'pickup_employee', 'delivery_employee'
            )
            THEN (new.raw_user_meta_data->>'role')::user_role
            ELSE 'customer'::user_role
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
