SELECT count(*)::bigint AS count,coalesce(min(xmin::text::bigint),0)::bigint AS version FROM zc_jobs.job WHERE task='rotateTrackTournament'
