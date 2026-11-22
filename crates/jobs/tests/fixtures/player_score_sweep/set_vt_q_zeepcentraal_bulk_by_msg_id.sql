UPDATE pgmq.q_zeepcentraal_bulk SET vt=clock_timestamp()+interval '1 hour' WHERE msg_id=$1::bigint
