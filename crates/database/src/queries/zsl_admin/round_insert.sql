INSERT INTO public.zsl_round (id_season, round, name, workshop_id, steam_announcement_id,
    event_date, event2_date, submission_start, submission_end, zsl_vote_end, cosmetic_vote_end)
SELECT "seasonId", number, name, coalesce("workshopId", 0), "steamAnnouncementId", "eventDate", "event2Date",
    "submissionStart", "submissionEnd", "zslVoteEnd", "cosmeticVoteEnd"
FROM jsonb_to_record($1) AS input("seasonId" integer, number integer, name text, "workshopId" bigint,
    "steamAnnouncementId" bigint, "eventDate" timestamptz, "event2Date" timestamptz, "submissionStart" timestamptz,
    "submissionEnd" timestamptz, "zslVoteEnd" timestamptz, "cosmeticVoteEnd" timestamptz)
ON CONFLICT (id_season, round) DO NOTHING
RETURNING id
