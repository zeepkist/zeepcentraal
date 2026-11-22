SELECT jsonb_build_object(
    'points', (SELECT coalesce(jsonb_agg(row ORDER BY id), '[]') FROM (
        SELECT id, jsonb_build_object('id', id, 'version', coalesce(date_updated, date_created),
            'name', name, 'points', points, 'minimumPoints', minimum_points, 'bestOf', best_of) AS row
        FROM public.zsl_points_structure) p),
    'seasons', (SELECT coalesce(jsonb_agg(row ORDER BY id DESC), '[]') FROM (
        SELECT id, jsonb_build_object('id', id, 'version', coalesce(date_updated, date_created),
            'name', name, 'pointsStructureId', id_points_structure, 'startDate', start_date, 'endDate', end_date) AS row
        FROM public.zsl_season) s),
    'rounds', (SELECT coalesce(jsonb_agg(row ORDER BY event_date DESC, id DESC), '[]') FROM (
        SELECT id, event_date, jsonb_build_object('id', id, 'version', coalesce(date_updated, date_created),
            'name', name, 'seasonId', id_season, 'number', round, 'workshopId', workshop_id::text,
            'steamAnnouncementId', steam_announcement_id::text, 'eventDate', event_date, 'event2Date', event2_date,
            'submissionStart', submission_start, 'submissionEnd', submission_end, 'zslVoteEnd', zsl_vote_end,
            'cosmeticVoteEnd', cosmetic_vote_end) AS row
        FROM public.zsl_round) r)
) AS value
