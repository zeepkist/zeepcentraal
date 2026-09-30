DO $$
BEGIN
    RAISE EXCEPTION 'Corrected tournament dates cannot be automatically reverted';
END
$$;
