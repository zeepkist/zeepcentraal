ALTER TABLE public.zsl_round ADD COLUMN event2_date timestamptz;
UPDATE public.zsl_round SET event2_date = '2026-10-11T23:00:00Z'::timestamptz WHERE id = 50;
CREATE TABLE zc_private.zsl_practice_playlist (
    id_zsl_round integer NOT NULL REFERENCES public.zsl_round(id) ON DELETE CASCADE,
    playlist_url text NOT NULL,
    object_key text NOT NULL,
    content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 1048576),
    date_updated timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (id_zsl_round, playlist_url)
);
