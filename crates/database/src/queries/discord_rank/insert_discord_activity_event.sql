INSERT INTO public.discord_activity_event(kind,payload,occurred_at) VALUES('rank_batch',jsonb_build_object('changes',$1::jsonb),to_timestamp($2::bigint::double precision/1000))
