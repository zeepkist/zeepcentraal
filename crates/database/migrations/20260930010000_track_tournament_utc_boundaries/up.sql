-- Repair only active, canonical midnight periods. Results remain untouched,
-- including entries accepted before the corrected 06:00 UTC start.
-- Share rotation locks so finalization cannot race this repair.
SELECT pg_advisory_xact_lock(1953744431, 0);
SELECT pg_advisory_xact_lock(1953744431, 1);

WITH observed AS MATERIALIZED (
    SELECT statement_timestamp() AS at
), canonical AS (
    SELECT tournament.id, tournament.type, tournament.slug,
           tournament.start_at, tournament.end_at,
           CASE WHEN tournament.type = 0
                THEN date_trunc('week', tournament.start_at AT TIME ZONE 'UTC')
                ELSE date_trunc('month', tournament.start_at AT TIME ZONE 'UTC')
           END AS utc_start
    FROM public.track_tournament tournament
    CROSS JOIN observed
    WHERE tournament.type IN (0, 1)
      AND tournament.finalized_at IS NULL
      AND tournament.start_at <= observed.at
      AND tournament.end_at > observed.at
), repair AS (
    SELECT id
    FROM canonical
    WHERE start_at = utc_start AT TIME ZONE 'UTC'
      AND end_at = (utc_start + CASE WHEN type = 0
                    THEN interval '1 week' ELSE interval '1 month' END) AT TIME ZONE 'UTC'
      AND slug = CASE WHEN type = 0 THEN to_char(utc_start, 'IYYY-"W"IW')
                      ELSE to_char(utc_start, 'YYYY-MM') END
)
UPDATE public.track_tournament tournament
SET start_at = tournament.start_at + interval '6 hours',
    end_at = tournament.end_at + interval '6 hours',
    date_updated = observed.at
FROM repair, observed
WHERE tournament.id = repair.id;
