DO $$ BEGIN
    RAISE EXCEPTION 'First-party submission migration deletes Discord source values; restore pre-migration database backup to roll back';
END $$;
