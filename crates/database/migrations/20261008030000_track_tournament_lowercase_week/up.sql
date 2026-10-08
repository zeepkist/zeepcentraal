-- Serialize with weekly rotation. Preserve tournament identity and all other fields.
SELECT pg_advisory_xact_lock(1953744431, 0);

-- A conflicting lowercase slug fails the transaction through UNIQUE(type, slug).
UPDATE public.track_tournament
SET slug = replace(slug, 'W', 'w')
WHERE type = 0
  AND slug ~ '^[0-9]{4}-W[0-9]{2}$';
