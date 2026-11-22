SELECT EXISTS(SELECT 1 FROM public."user" WHERE steam_id=$1 AND role='admin' AND NOT banned) AS allowed
