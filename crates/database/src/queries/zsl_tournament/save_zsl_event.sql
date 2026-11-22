UPDATE zc_private.zsl_tournament_state SET state=$3,lease_until=clock_timestamp()+interval '90 seconds',date_updated=clock_timestamp() WHERE id_round=$1 AND owner=$2 AND lease_until>clock_timestamp()
