UPDATE pgmq.q_zeepcentraal_bulk SET vt=clock_timestamp() WHERE msg_id=$1
