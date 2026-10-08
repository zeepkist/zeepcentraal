DO $$
BEGIN
    RAISE EXCEPTION 'Corrected tournament slugs cannot be automatically reverted';
END
$$;
