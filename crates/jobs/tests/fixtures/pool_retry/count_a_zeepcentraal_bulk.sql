SELECT count(*)::bigint AS count FROM pgmq.a_zeepcentraal_bulk WHERE message->>'failure'='attempts_exhausted'
