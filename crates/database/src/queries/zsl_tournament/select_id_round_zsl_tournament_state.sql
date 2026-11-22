SELECT id_round AS id FROM zc_private.zsl_tournament_state WHERE id_round=$1 AND owner=$2 AND lease_until>clock_timestamp() FOR UPDATE
