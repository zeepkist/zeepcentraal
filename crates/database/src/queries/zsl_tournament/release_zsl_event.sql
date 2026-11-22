UPDATE zc_private.zsl_tournament_state SET lease_until=clock_timestamp() WHERE id_round=$1 AND owner=$2
