-- Create a function that will be executed by the trigger
CREATE OR REPLACE FUNCTION public.create_tracking_event_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert an event if the status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.tracking_events (
            package_id, 
            status, 
            remarks, 
            timestamp
        ) VALUES (
            NEW.package_id, 
            NEW.status, 
            'Status automatically updated from ' || OLD.status || ' to ' || NEW.status || '.', 
            CURRENT_TIMESTAMP
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the packages table
CREATE TRIGGER on_package_status_update
    AFTER UPDATE OF status ON public.packages
    FOR EACH ROW
    EXECUTE FUNCTION public.create_tracking_event_on_status_change();
