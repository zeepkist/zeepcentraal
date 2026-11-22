jsonb_build_object('roundId',r.id,'contestId',c.id,'name',r.name,'seasonId',r.id_season,'round',r.round,'rules',c.rules,'steamAnnouncementId',r.steam_announcement_id::text,
'submissionStart',r.submission_start,'submissionEnd',r.submission_end,'zslVoteEnd',r.zsl_vote_end,'cosmeticVoteEnd',r.cosmetic_vote_end,
'submissionsOpen',coalesce(c.state='open' AND r.submission_start<=now() AND now()<r.submission_end,false),
'resultTypes',CASE WHEN c.state='frozen' AND c.finalized_at IS NOT NULL AND c.current_playlist_id IS NOT NULL THEN
    to_jsonb(array_remove(ARRAY[CASE WHEN clock_timestamp()>=r.zsl_vote_end THEN 1 END,CASE WHEN clock_timestamp()>=r.cosmetic_vote_end THEN 2 END,CASE WHEN clock_timestamp()>=r.cosmetic_vote_end THEN 3 END],NULL)) ELSE '[]'::jsonb END,
'openTypes',CASE WHEN c.state='frozen' AND c.finalized_at IS NOT NULL AND now()>=r.submission_end THEN
    to_jsonb(array_remove(ARRAY[CASE WHEN now()<r.zsl_vote_end THEN 1 END,CASE WHEN now()<r.cosmetic_vote_end THEN 2 END,CASE WHEN now()<r.cosmetic_vote_end THEN 3 END],NULL)) ELSE '[]'::jsonb END)
