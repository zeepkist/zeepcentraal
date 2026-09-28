CREATE TABLE zc_private.donations (
    message_id uuid PRIMARY KEY,
    timestamp timestamptz NOT NULL,
    type text NOT NULL CHECK (type IN ('Tip', 'Donation', 'Subscription', 'Commission', 'Shop Order')),
    is_public boolean NOT NULL,
    url text NOT NULL,
    is_subscription_payment boolean NOT NULL,
    is_first_subscription_payment boolean NOT NULL,
    kofi_transaction_id uuid NOT NULL UNIQUE,
    tier_name text,
    discord_userid bigint CHECK (discord_userid > 0)
);
CREATE INDEX donations_public_discord_timestamp
    ON zc_private.donations (discord_userid, timestamp DESC, message_id DESC)
    WHERE is_public AND discord_userid IS NOT NULL;
REVOKE ALL ON zc_private.donations FROM PUBLIC, zeepcentraal_graphql;

CREATE VIEW public.donations WITH (security_barrier = true) AS
SELECT
    bool_or(is_subscription_payment AND timestamp > CURRENT_TIMESTAMP - INTERVAL '35 days'
        AND timestamp <= CURRENT_TIMESTAMP) AS is_subscription_payment,
    (array_agg(NULLIF(btrim(tier_name), '') ORDER BY timestamp DESC, message_id DESC)
        FILTER (WHERE NULLIF(btrim(tier_name), '') IS NOT NULL))[1] AS tier_name,
    discord_userid
FROM zc_private.donations
WHERE is_public AND discord_userid IS NOT NULL
GROUP BY discord_userid;
COMMENT ON VIEW public.donations IS E'@primaryKey discord_userid\n@behavior -insert -update -delete';
REVOKE ALL ON public.donations FROM PUBLIC;
GRANT SELECT ON public.donations TO zeepcentraal_graphql;

CREATE FUNCTION public.user_donation(user_row public."user")
RETURNS public.donations
LANGUAGE sql STABLE PARALLEL SAFE SECURITY INVOKER
SET search_path = pg_catalog
AS $$
    SELECT donation FROM public.donations AS donation
    WHERE donation.discord_userid = user_row.discord_id AND user_row.discord_id > 0;
$$;
REVOKE ALL ON FUNCTION public.user_donation(public."user") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_donation(public."user") TO zeepcentraal_graphql;
