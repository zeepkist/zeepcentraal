DELETE FROM public.auth WHERE id_user=$1 AND refresh_token_hash=$2 AND refresh_token_expiry>extract(epoch from clock_timestamp())::bigint
