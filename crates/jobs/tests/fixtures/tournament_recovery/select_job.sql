SELECT coalesce(max(xmin::text::bigint),0)::bigint AS count FROM zc_jobs.job WHERE task='rotateTrackTournament'
