UPDATE zc_private.zsl_tournament_state SET published_at=coalesce(published_at,clock_timestamp()) WHERE id_round=$1
