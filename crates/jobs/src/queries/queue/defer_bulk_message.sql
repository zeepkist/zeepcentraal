UPDATE pgmq.q_zeepcentraal_bulk SET vt=clock_timestamp()+$1*interval '1 millisecond' WHERE msg_id=$2::bigint
