SELECT message->>'failure' FROM pgmq.a_zeepcentraal_{{lane}} WHERE msg_id=$1
