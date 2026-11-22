SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=1861284951 AND objid=0 AND granted) AS valid
