
WITH contest AS (
    SELECT c.id, {{contest_json}} AS payload
    FROM public.zsl_round r JOIN zc_private.level_submission_contest c ON c.id_zsl_round=r.id
    WHERE ($1 IS NULL OR r.id=$1)
    ORDER BY coalesce(c.state='open' AND r.submission_start<=now() AND now()<r.submission_end,false) DESC,
        r.id_season DESC,r.round DESC LIMIT 1
), selected AS (
    SELECT s.* FROM zc_private.level_submissions s JOIN contest c ON c.id=s.id_contest
    WHERE s.state='selected'
), accepted AS (
    SELECT s.id,s.date_created,jsonb_build_object(
        'id',s.id,'workshopId',s.workshop_id::text,'fileUid',v.file_uid,
        'name',v.payload->>'name','authors',s.authors,
        'authorNames',coalesce(a.names,'[]'::jsonb),
        'level',jsonb_build_object('id',l.id,'xxHash',l.xx_hash,'favourited',false,
            'fileUid',v.file_uid,'name',v.payload->>'name','authorName',a.label,
            'workshopId',s.workshop_id::text,'adventure',l.adventure,'dateCreated',s.date_created,
            'points',p.points,'rating',p.rating,
            'recordCount',(SELECT count(*) FROM (SELECT eligible_source.* FROM public.record eligible_source WHERE NOT EXISTS(SELECT 1 FROM zc_private.record_validation invalid WHERE invalid.id_record=eligible_source.id AND invalid.status='fail')) record WHERE record.id_level=l.id),
            'personalBestCount',(SELECT count(*) FROM (SELECT eligible_source.* FROM public.personal_best_global eligible_source WHERE NOT EXISTS(SELECT 1 FROM zc_private.record_validation invalid WHERE invalid.id_record=eligible_source.id_record AND invalid.status='fail')) pb WHERE pb.id_level=l.id),
            'voteCount',(SELECT count(*) FROM public.vote vote WHERE vote.id_level=l.id),
            'imageUrl',CASE WHEN media.url LIKE 'https://%' THEN media.url WHEN media.url IS NOT NULL THEN 'https://cdn.zeepki.st/' || ltrim(media.url,'/') END)) AS payload
    FROM selected s JOIN zc_private.level_submission_validation v
        ON v.id=s.latest_validation_id AND v.id_submission=s.id AND v.submission_revision=s.revision
    JOIN public.level l ON l.xx_hash=s.level_hash
    LEFT JOIN public.level_points p ON p.id_level=l.id
    LEFT JOIN public.workshop_item w ON w.workshop_id=s.workshop_id
    LEFT JOIN LATERAL (SELECT image_url FROM public.level_item
        WHERE id_level=l.id AND workshop_id=s.workshop_id ORDER BY id DESC LIMIT 1) i ON true
    LEFT JOIN LATERAL (SELECT coalesce(nullif(v.payload->>'thumbnailUrl',''),nullif(i.image_url,''),nullif(w.image_url,'')) AS url) media ON true
    LEFT JOIN LATERAL (SELECT jsonb_agg(coalesce(u.steam_name,a.id) ORDER BY a.n) AS names,
        string_agg(coalesce(u.steam_name,a.id), ', ' ORDER BY a.n) AS label
        FROM unnest(s.authors) WITH ORDINALITY a(id,n)
        LEFT JOIN public."user" u ON u.steam_id::text=a.id) a ON true
    WHERE v.valid AND nullif(v.file_uid,'') IS NOT NULL AND v.payload->>'uid'=v.file_uid
        AND nullif(v.payload->>'name','') IS NOT NULL AND nullif(v.payload->>'sha256','') IS NOT NULL
)
SELECT jsonb_build_object('contest',(SELECT payload FROM contest),
    'totalCount',(SELECT count(*) FROM selected),'validCount',(SELECT count(*) FROM accepted),
    'submissions',coalesce((SELECT jsonb_agg(payload ORDER BY date_created,id) FROM accepted),'[]'::jsonb)) AS payload
