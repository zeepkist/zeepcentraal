UPDATE public.zsl_round r
SET id_season = input."seasonId", round = input.number, name = input.name,
    workshop_id = coalesce(input."workshopId", 0), steam_announcement_id = input."steamAnnouncementId",
    event_date = input."eventDate", event2_date = input."event2Date",
    submission_start = input."submissionStart", submission_end = input."submissionEnd",
    zsl_vote_end = input."zslVoteEnd", cosmetic_vote_end = input."cosmeticVoteEnd",
    date_updated = clock_timestamp()
FROM jsonb_to_record($1) AS input("seasonId" integer, number integer, name text, "workshopId" bigint,
    "steamAnnouncementId" bigint, "eventDate" timestamptz, "event2Date" timestamptz, "submissionStart" timestamptz,
    "submissionEnd" timestamptz, "zslVoteEnd" timestamptz, "cosmeticVoteEnd" timestamptz)
WHERE r.id = $2 AND coalesce(r.date_updated, r.date_created) = $3::timestamptz
AND ((r.id_season, r.round) = (input."seasonId", input.number)
    OR (r.event_date > clock_timestamp() + interval '20 minutes'
        AND NOT EXISTS (SELECT FROM zc_private.level_submission_contest c WHERE c.id_zsl_round = r.id)
        AND NOT EXISTS (SELECT FROM public.zsl_round_result result WHERE result.id_round = r.id)))
AND NOT EXISTS (SELECT FROM public.zsl_round other
    WHERE other.id_season = input."seasonId" AND other.round = input.number AND other.id <> r.id)
AND (r.event_date = input."eventDate"
    OR least(r.event_date, input."eventDate") > clock_timestamp() + interval '20 minutes')
AND (r.event2_date IS NOT DISTINCT FROM input."event2Date"
    OR least(r.event2_date, input."event2Date") > clock_timestamp() + interval '20 minutes')
AND (r.submission_start IS NOT DISTINCT FROM input."submissionStart"
    OR least(r.submission_start, input."submissionStart") > clock_timestamp())
AND (r.submission_end IS NOT DISTINCT FROM input."submissionEnd"
    OR least(r.submission_end, input."submissionEnd") > clock_timestamp())
AND (r.zsl_vote_end IS NOT DISTINCT FROM input."zslVoteEnd"
    OR least(r.zsl_vote_end, input."zslVoteEnd") > clock_timestamp())
AND (r.cosmetic_vote_end IS NOT DISTINCT FROM input."cosmeticVoteEnd"
    OR least(r.cosmetic_vote_end, input."cosmeticVoteEnd") > clock_timestamp())
RETURNING r.id
