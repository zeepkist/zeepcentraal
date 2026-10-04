ALTER TABLE public.level ADD COLUMN simhash bigint;
COMMENT ON COLUMN public.level.simhash IS
    'SimHash v1: block-ID frequencies; XXH3-64 of little-endian i64 IDs; positive votes set bits, ties clear bits; signed bigint stores all 64 bits.';

CREATE INDEX "IX_level_public_simhash" ON public.level (simhash, id)
    WHERE publicly_visible = true AND simhash IS NOT NULL;
CREATE INDEX "IX_level_missing_simhash" ON public.level (id) WHERE simhash IS NULL;

CREATE FUNCTION public.similar_levels(xx_hash text, max_distance integer DEFAULT 16)
RETURNS SETOF public.level
LANGUAGE sql STABLE PARALLEL SAFE SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
    WITH source AS MATERIALIZED (
        SELECT id, simhash FROM public.level
        WHERE public.level.xx_hash = upper($1)
            AND publicly_visible = true AND simhash IS NOT NULL
            AND $2 BETWEEN 0 AND 64
    ), matches AS MATERIALIZED (
        SELECT candidate.id,
            bit_count(candidate.simhash::bit(64) # source.simhash::bit(64)) AS distance
        FROM public.level AS candidate CROSS JOIN source
        WHERE candidate.publicly_visible = true AND candidate.simhash IS NOT NULL
            AND candidate.id <> source.id
            AND bit_count(candidate.simhash::bit(64) # source.simhash::bit(64)) <= $2
    )
    SELECT candidate.* FROM matches
    JOIN public.level AS candidate ON candidate.id = matches.id
    ORDER BY matches.distance ASC, candidate.id ASC;
$$;
REVOKE ALL ON FUNCTION public.similar_levels(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.similar_levels(text, integer) TO zeepcentraal_graphql;
